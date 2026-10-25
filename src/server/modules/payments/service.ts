import mysql from 'mysql2/promise';
import { ApiError, notFound } from '../../middleware/errors';
import { pool, queryOne, tx } from '../../database/pool';
import { getSettings } from '../settings/service';
import { logAudit } from '../audit/service';
import { expirePending } from '../reservations/service';
import * as races from '../races/service';

export interface ConfirmPaymentInput {
  method: 'transfer' | 'cash' | 'other';
  amount?: number | null;
  reference?: string | null;
  note?: string | null;
}

export interface AdminCtx {
  adminId: number | null;
  ip?: string | null;
}

export interface ConfirmResult {
  reservationId: number;
  alreadyConfirmed: boolean;
}


export async function confirmPayment(
  reservationId: number,
  input: ConfirmPaymentInput,
  ctx: AdminCtx
): Promise<ConfirmResult> {
  await expirePending();
  const settings = await getSettings();

  const result = await tx(async (conn) => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT res.id, res.status, res.expires_at, r.event_id
       FROM reservations res JOIN races r ON r.id = res.race_id
       WHERE res.id = ? FOR UPDATE`,
      [reservationId]
    );
    const res = (rows as unknown as {
      id: number;
      status: string;
      expires_at: string | null;
      event_id: number;
    }[])[0];
    if (!res) throw notFound('Inscripción no encontrada');

    if (res.status === 'confirmed') {
      return { reservationId, alreadyConfirmed: true };
    }
    if (res.status === 'expired') {
      throw new ApiError(409, 'EXPIRED', 'La solicitud expiró; revalídala con "Reactivar" antes de confirmar el pago');
    }
    if (res.status === 'cancelled') {
      throw new ApiError(409, 'CANCELLED', 'La solicitud fue cancelada por el administrador');
    }


    const [vigency] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT (expires_at < NOW()) AS expired FROM reservations WHERE id = ?',
      [reservationId]
    );
    if (Number((vigency as unknown as { expired: number }[])[0].expired) === 1) {
      await conn.query("UPDATE reservations SET status = 'expired' WHERE id = ?", [reservationId]);
      throw new ApiError(409, 'EXPIRED', 'La solicitud venció durante la operación; revalídala antes de confirmar');
    }

    const amount = input.amount ?? (settings.entryPrice > 0 ? settings.entryPrice : null);
    const [updated] = await conn.query<mysql.ResultSetHeader>(
      "UPDATE reservations SET status = 'confirmed', confirmed_at = NOW() WHERE id = ? AND status = 'pending_payment'",
      [reservationId]
    );
    if (updated.affectedRows !== 1) {
      throw new ApiError(409, 'CONFLICT', 'No se pudo confirmar: la reserva cambió de estado concurrentemente');
    }

    await conn.query(
      `INSERT INTO payments (reservation_id, method, amount, reference, status, confirmed_by, confirmed_at, note)
       VALUES (?, ?, ?, ?, 'confirmed', ?, NOW(), ?)`,
      [reservationId, input.method, amount, input.reference ?? null, ctx.adminId, input.note ?? null]
    );

    await logAudit({
      adminId: ctx.adminId,
      action: 'payment.confirm',
      entity: 'reservation',
      entityId: reservationId,
      details: { method: input.method, amount, raceEventId: Number(res.event_id) },
      ip: ctx.ip,
    });

    return { reservationId, alreadyConfirmed: false };
  });


  const raceRow = await queryOne<{ event_id: number }>(
    'SELECT r.event_id FROM reservations res JOIN races r ON r.id = res.race_id WHERE res.id = ?',
    [reservationId]
  );
  if (raceRow) {
    await races.ensureNextRace(Number(raceRow.event_id), { adminId: ctx.adminId, ip: ctx.ip });
  }
  return result;
}

export async function reactivate(reservationId: number, ctx: AdminCtx): Promise<void> {
  const settings = await getSettings();
  await tx(async (conn) => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT res.id, res.status, res.lane, res.car_id, res.race_id, r.status AS race_status
       FROM reservations res JOIN races r ON r.id = res.race_id
       WHERE res.id = ? FOR UPDATE`,
      [reservationId]
    );
    const res = (rows as unknown as {
      id: number;
      status: string;
      lane: number;
      car_id: number;
      race_id: number;
      race_status: string;
    }[])[0];
    if (!res) throw notFound('Inscripción no encontrada');
    if (res.status === 'confirmed') {
      throw new ApiError(409, 'ALREADY_CONFIRMED', 'La reserva ya está confirmada');
    }
    if (String(res.race_status) !== 'open') {
      throw new ApiError(409, 'RACE_NOT_OPEN', 'La carrera no está abierta; no se puede revalidar');
    }

    if (res.status === 'expired' || res.status === 'cancelled') {
      // Carril libre
      const [laneRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id FROM reservations WHERE race_id = ? AND lane = ? AND status IN ('pending_payment','confirmed')`,
        [res.race_id, res.lane]
      );
      if (laneRows.length > 0) {
        throw new ApiError(409, 'LANE_TAKEN', 'El carril ya fue ocupado por otra inscripción');
      }
      // Coche libre
      const [carRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id FROM reservations WHERE race_id = ? AND car_id = ? AND status IN ('pending_payment','confirmed')`,
        [res.race_id, res.car_id]
      );
      if (carRows.length > 0) {
        throw new ApiError(409, 'CAR_TAKEN', 'El coche ya fue reservado en esta carrera');
      }
    }

    await conn.query(
      `UPDATE reservations
       SET status = 'pending_payment', confirmed_at = NULL,
           expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE id = ?`,
      [settings.reservationExpiryMinutes, reservationId]
    );
  });

  await logAudit({
    adminId: ctx.adminId,
    action: 'reservation.reactivate',
    entity: 'reservation',
    entityId: reservationId,
    ip: ctx.ip,
  });
}


export async function cancelReservation(reservationId: number, ctx: AdminCtx): Promise<void> {
  await tx(async (conn) => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id, status FROM reservations WHERE id = ? FOR UPDATE',
      [reservationId]
    );
    const res = (rows as unknown as { id: number; status: string }[])[0];
    if (!res) throw notFound('Inscripción no encontrada');
    if (res.status !== 'pending_payment' && res.status !== 'confirmed') {
      throw new ApiError(409, 'INVALID_STATUS', `No se puede cancelar una reserva en estado "${res.status}"`);
    }
    await conn.query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservationId]);
  });
  await logAudit({
    adminId: ctx.adminId,
    action: 'reservation.cancel',
    entity: 'reservation',
    entityId: reservationId,
    ip: ctx.ip,
  });
}
