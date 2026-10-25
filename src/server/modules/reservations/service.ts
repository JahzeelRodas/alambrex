import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { ApiError, notFound } from '../../middleware/errors';
import { LANES_PER_RACE } from '../../config/env';
import { pool, query, queryOne, tx } from '../../database/pool';
import { getSettings } from '../settings/service';
import { isValidLane } from './logic';
import { logAudit } from '../audit/service';

const ACTIVE_SQL = "('pending_payment','confirmed')";

export interface ReservationRow {
  id: number;
  race_id: number;
  lane: number;
  car_id: number;
  participant_name: string;
  contact: string;
  status: string;
  token: string;
  expires_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminReservationView {
  id: number;
  lane: number;
  status: string;
  participantName: string;
  contact: string;
  token: string;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  raceId: number;
  raceNumber: number;
  raceStatus: string;
  eventName: string;
  carName: string;
  isExpired: boolean;
}

export interface PublicReservationView {
  id: number;
  token: string;
  lane: number;
  status: string;
  participantName: string;
  carId: number;
  carName: string;
  carImage: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  race: { id: number; raceNumber: number; status: string };
  event: { id: number; name: string };
}


export async function expirePending(): Promise<void> {
  await query(
    "UPDATE reservations SET status = 'expired' WHERE status = 'pending_payment' AND expires_at < NOW()"
  );
}

export async function createReservation(
  input: { raceId: number; lane: number; carId: number; participantName: string; contact: string },
  ctx: { ip?: string | null }
): Promise<{ token: string; reservationId: number }> {

  await expirePending();
  const settings = await getSettings();

  return tx(async (conn) => {

    const [raceRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT r.id, r.status, r.event_id, e.status AS event_status, e.is_current
       FROM races r JOIN events e ON e.id = r.event_id
       WHERE r.id = ? FOR UPDATE`,
      [input.raceId]
    );
    const race = (raceRows as unknown as {
      id: number;
      status: string;
      event_id: number;
      event_status: string;
      is_current: number;
    }[])[0];
    if (!race) throw notFound('Carrera no encontrada');
    if (Number(race.is_current) !== 1 || String(race.event_status) !== 'active') {
      throw new ApiError(409, 'EVENT_NOT_ACTIVE', 'La jornada no acepta inscripciones ahora mismo');
    }
    if (String(race.status) !== 'open') {
      throw new ApiError(409, 'RACE_NOT_OPEN', 'La carrera no está abierta para inscripciones');
    }
    if (!isValidLane(input.lane)) {
      throw new ApiError(400, 'INVALID_LANE', 'Carril inválido');
    }


    const [carRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id, is_active FROM cars WHERE id = ?',
      [input.carId]
    );
    const car = (carRows as unknown as { id: number; is_active: number }[])[0];
    if (!car || Number(car.is_active) !== 1) {
      throw new ApiError(409, 'CAR_UNAVAILABLE', 'El coche no está disponible');
    }


    const [countRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM reservations WHERE race_id = ? AND status IN ${ACTIVE_SQL}`,
      [input.raceId]
    );
    const total = Number((countRows as unknown as { total: number }[])[0].total);
    if (total >= LANES_PER_RACE) {
      throw new ApiError(409, 'RACE_FULL', 'La carrera está completa');
    }


    const [laneRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM reservations WHERE race_id = ? AND lane = ? AND status IN ${ACTIVE_SQL} FOR UPDATE`,
      [input.raceId, input.lane]
    );
    if (laneRows.length > 0) {
      throw new ApiError(409, 'LANE_TAKEN', 'El carril acaba de ser ocupado; elige otro');
    }
    const [carTakenRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM reservations WHERE race_id = ? AND car_id = ? AND status IN ${ACTIVE_SQL}`,
      [input.raceId, input.carId]
    );
    if (carTakenRows.length > 0) {
      throw new ApiError(409, 'CAR_TAKEN', 'Ese coche ya está reservado en esta carrera');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const [insertResult] = await conn.query<mysql.ResultSetHeader>(
      `INSERT INTO reservations (race_id, lane, car_id, participant_name, contact, token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [input.raceId, input.lane, input.carId, input.participantName, input.contact, token, settings.reservationExpiryMinutes]
    );

    await logAudit({
      action: 'reservation.create',
      entity: 'reservation',
      entityId: Number(insertResult.insertId),
      details: { raceId: input.raceId, lane: input.lane, carId: input.carId },
      ip: ctx.ip ?? null,
    });

    return { token, reservationId: Number(insertResult.insertId) };
  });
}

export async function getReservationByToken(token: string): Promise<PublicReservationView | null> {
  await expirePending();
  const row = await queryOne<Record<string, unknown>>(
    `SELECT res.id, res.token, res.lane, res.status, res.participant_name, res.expires_at, res.confirmed_at,
            c.id AS car_id, c.name AS car_name, c.image_url AS car_image,
            r.id AS race_id, r.race_number, r.status AS race_status,
            e.id AS event_id, e.name AS event_name
     FROM reservations res
     JOIN races r ON r.id = res.race_id
     JOIN events e ON e.id = r.event_id
     JOIN cars c ON c.id = res.car_id
     WHERE res.token = ?`,
    [token]
  );
  if (!row) return null;
  return {
    id: Number(row.id),
    token: String(row.token),
    lane: Number(row.lane),
    status: String(row.status),
    participantName: String(row.participant_name),
    carId: Number(row.car_id),
    carName: String(row.car_name),
    carImage: row.car_image ? String(row.car_image) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string).toISOString() : null,
    race: { id: Number(row.race_id), raceNumber: Number(row.race_number), status: String(row.race_status) },
    event: { id: Number(row.event_id), name: String(row.event_name) },
  };
}

export async function listAdmin(options: {
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: AdminReservationView[]; total: number }> {
  const { status, limit, offset } = options;
  const where = status ? 'WHERE res.status = ?' : '';
  const params = status ? [status] : [];

  const [rows, totalRows] = await Promise.all([
    pool.query<mysql.RowDataPacket[]>(
      `SELECT res.id, res.lane, res.status, res.participant_name, res.contact, res.token,
              res.expires_at, res.confirmed_at, res.created_at,
              r.id AS race_id, r.race_number, r.status AS race_status,
              e.name AS event_name, c.name AS car_name
       FROM reservations res
       JOIN races r ON r.id = res.race_id
       JOIN events e ON e.id = r.event_id
       JOIN cars c ON c.id = res.car_id
       ${where}
       ORDER BY res.created_at DESC, res.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM reservations res ${where}`,
      params
    ),
  ]);

  const mapped = (rows[0] as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    lane: Number(r.lane),
    status: String(r.status),
    participantName: String(r.participant_name),
    contact: String(r.contact),
    token: String(r.token),
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    raceId: Number(r.race_id),
    raceNumber: Number(r.race_number),
    raceStatus: String(r.race_status),
    eventName: String(r.event_name),
    carName: String(r.car_name),
    isExpired: r.status === 'pending_payment' && r.expires_at ? new Date(r.expires_at as string).getTime() < Date.now() : false,
  }));

  return { rows: mapped, total: Number((totalRows[0] as unknown as { total: number }[])[0].total) };
}
