import mysql from 'mysql2/promise';
import { ApiError, notFound } from '../../middleware/errors';
import { pool, queryOne, tx } from '../../database/pool';
import { logAudit } from '../audit/service';
import * as races from '../races/service';
import type { AdminCtx } from '../payments/service';

export interface ResultRow {
  id: number;
  raceId: number;
  raceNumber: number;
  eventName: string;
  lane: number;
  carName: string;
  participantName: string;
  finishedAt: string | null;
  createdAt: string;
}


export async function registerWinner(raceId: number, lane: number, ctx: AdminCtx): Promise<void> {
  await tx(async (conn) => {
    const [raceRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id, status, event_id FROM races WHERE id = ? FOR UPDATE',
      [raceId]
    );
    const race = (raceRows as unknown as { id: number; status: string; event_id: number }[])[0];
    if (!race) throw notFound('Carrera no encontrada');
    if (!['open', 'running'].includes(String(race.status))) {
      throw new ApiError(409, 'RACE_NOT_ACTIVE', 'Solo carreras abiertas o en marcha pueden tener ganador');
    }

    const [resRows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, car_id FROM reservations WHERE race_id = ? AND lane = ? AND status = 'confirmed'",
      [raceId, lane]
    );
    const reservation = (resRows as unknown as { id: number; car_id: number }[])[0];
    if (!reservation) {
      throw new ApiError(409, 'LANE_NOT_CONFIRMED', 'El carril no tiene una inscripción confirmada');
    }

    await conn.query(
      "UPDATE races SET status = 'finished', winner_lane = ?, finished_at = NOW() WHERE id = ?",
      [lane, raceId]
    );
    await conn.query<mysql.ResultSetHeader>(
      `INSERT INTO race_results (race_id, lane, car_id, reservation_id, position, is_winner, recorded_by)
       VALUES (?, ?, ?, ?, 1, 1, ?)
       ON DUPLICATE KEY UPDATE
         car_id = VALUES(car_id),
         reservation_id = VALUES(reservation_id),
         is_winner = 1,
         recorded_by = VALUES(recorded_by)`,
      [raceId, lane, reservation.car_id, reservation.id, ctx.adminId]
    );

    await logAudit({
      adminId: ctx.adminId,
      action: 'race.winner',
      entity: 'race',
      entityId: raceId,
      details: { lane },
      ip: ctx.ip,
    });
  });


  const raceRow = await queryOne<{ event_id: number }>('SELECT event_id FROM races WHERE id = ?', [raceId]);
  if (raceRow) {
    await races.ensureNextRace(Number(raceRow.event_id), { adminId: ctx.adminId, ip: ctx.ip });
  }
}


export async function clearWinner(raceId: number, ctx: AdminCtx): Promise<void> {
  await tx(async (conn) => {
    const [raceRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id, status FROM races WHERE id = ? FOR UPDATE',
      [raceId]
    );
    const race = (raceRows as unknown as { id: number; status: string }[])[0];
    if (!race) throw notFound('Carrera no encontrada');

    await conn.query('DELETE FROM race_results WHERE race_id = ?', [raceId]);
    await conn.query(
      "UPDATE races SET winner_lane = NULL, finished_at = NULL, status = IF(status = 'finished', 'running', status) WHERE id = ?",
      [raceId]
    );
  });
  await logAudit({
    adminId: ctx.adminId,
    action: 'race.winner_clear',
    entity: 'race',
    entityId: raceId,
    ip: ctx.ip,
  });
}


export async function recentResults(limit = 20): Promise<ResultRow[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT rr.id, rr.lane, rr.created_at, r.id AS race_id, r.race_number, r.finished_at,
            e.name AS event_name, c.name AS car_name, res.participant_name
     FROM race_results rr
     JOIN races r ON r.id = rr.race_id
     JOIN events e ON e.id = r.event_id
     JOIN cars c ON c.id = rr.car_id
     JOIN reservations res ON res.id = rr.reservation_id
     WHERE rr.is_winner = 1
     ORDER BY rr.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    raceId: Number(r.race_id),
    raceNumber: Number(r.race_number),
    eventName: String(r.event_name),
    lane: Number(r.lane),
    carName: String(r.car_name),
    participantName: String(r.participant_name),
    finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}


export interface EventResultsSummary {
  id: number;
  name: string;
  description: string | null;
  status: string;
  racesTotal: number;
  winnersTotal: number;
  lastWinAt: string | null;
}


/** Últimas jornadas que tienen al menos un ganador registrado. */
export async function recentEventsWithWinners(limit = 10): Promise<EventResultsSummary[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT e.id, e.name, e.description, e.status,
            (SELECT COUNT(*) FROM races r2 WHERE r2.event_id = e.id) AS races_total,
            COUNT(rr.id) AS winners_total,
            MAX(rr.created_at) AS last_win_at
     FROM events e
     JOIN races r ON r.event_id = e.id
     JOIN race_results rr ON rr.race_id = r.id AND rr.is_winner = 1
     GROUP BY e.id
     ORDER BY last_win_at DESC
     LIMIT ?`,
    [limit]
  );
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    status: String(r.status),
    racesTotal: Number(r.races_total),
    winnersTotal: Number(r.winners_total),
    lastWinAt: r.last_win_at ? new Date(r.last_win_at as string).toISOString() : null,
  }));
}


export interface EventWinnersRow {
  raceId: number;
  raceNumber: number;
  lane: number;
  carName: string;
  participantName: string;
  finishedAt: string | null;
}


/** Ganadores de todas las carreras de una jornada, ordenados por número de carrera. */
export async function eventWinners(eventId: number): Promise<EventWinnersRow[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT rr.lane, rr.created_at, r.id AS race_id, r.race_number, r.finished_at,
            c.name AS car_name, res.participant_name
     FROM race_results rr
     JOIN races r ON r.id = rr.race_id
     JOIN cars c ON c.id = rr.car_id
     JOIN reservations res ON res.id = rr.reservation_id
     WHERE rr.is_winner = 1 AND r.event_id = ?
     ORDER BY r.race_number ASC, rr.created_at DESC`,
    [eventId]
  );
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    raceId: Number(r.race_id),
    raceNumber: Number(r.race_number),
    lane: Number(r.lane),
    carName: String(r.car_name),
    participantName: String(r.participant_name),
    finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
  }));
}
