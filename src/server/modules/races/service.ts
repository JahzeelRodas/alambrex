import mysql from 'mysql2/promise';
import { ApiError } from '../../middleware/errors';
import { LANES_PER_RACE } from '../../config/env';
import { pool, query, queryOne, tx, type Row } from '../../database/pool';
import { assertRaceTransition } from '../reservations/logic';
import { logAudit } from '../audit/service';
import { getSettings } from '../settings/service';
import { notFound } from '../../middleware/errors';

const ACTIVE_SQL = "('pending_payment','confirmed')";

export interface LaneOccupancy {
  lane: number;
  reservationId: number | null;
  reservationStatus: 'pending_payment' | 'confirmed' | null;
  participantName: string | null;
  contact: string | null; 
  carId: number | null;
  carName: string | null;
  carImage: string | null;
  resUpdatedAt: string | null;
}

export interface RaceSummary {
  id: number;
  eventId: number;
  eventName?: string;
  raceNumber: number;
  status: string;
  isActive: boolean;
  winnerLane: number | null;
  finishedAt: string | null;
  occupied: number;
  confirmed: number;
  freeLanes: number;
  lanes: LaneOccupancy[];
  updatedAt: string;
}

export interface RaceRow {
  id: number;
  event_id: number;
  race_number: number;
  status: string;
  is_active: number;
  winner_lane: number | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RaceJoinRow extends RaceRow {
  event_name: string;
}

export interface StreamPayload {
  event: { id: number; name: string };
  race: RaceSummary;
  nextRace: { id: number; raceNumber: number; freeLanes: number } | null;
  version: string;
  pollMs: number;
}

function emptyLanes(): LaneOccupancy[] {
  return Array.from({ length: LANES_PER_RACE }, (_, i) => ({
    lane: i + 1,
    reservationId: null,
    reservationStatus: null,
    participantName: null,
    contact: null,
    carId: null,
    carName: null,
    carImage: null,
    resUpdatedAt: null,
  }));
}

async function loadOccupancy(raceIds: number[], includeContact: boolean): Promise<Map<number, LaneOccupancy[]>> {
  const map = new Map<number, LaneOccupancy[]>();
  for (const id of raceIds) map.set(id, emptyLanes());
  if (raceIds.length === 0) return map;

  const placeholders = raceIds.map(() => '?').join(',');
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT res.race_id, res.lane, res.id AS reservation_id, res.status, res.participant_name, res.contact,
            res.updated_at AS res_updated, c.id AS car_id, c.name AS car_name, c.image_url AS car_image
     FROM reservations res LEFT JOIN cars c ON c.id = res.car_id
     WHERE res.race_id IN (${placeholders}) AND res.status IN ${ACTIVE_SQL}
     ORDER BY res.race_id, res.lane`,
    raceIds
  );

  for (const row of rows) {
    const raceId = Number(row.race_id);
    const lanes = map.get(raceId);
    if (!lanes) continue;
    const lane = Number(row.lane);
    if (lane < 1 || lane > LANES_PER_RACE) continue;
    lanes[lane - 1] = {
      lane,
      reservationId: Number(row.reservation_id),
      reservationStatus: row.status as 'pending_payment' | 'confirmed',
      participantName: String(row.participant_name),
      contact: includeContact ? String(row.contact) : null,
      carId: Number(row.car_id),
      carName: row.car_name ? String(row.car_name) : null,
      carImage: row.car_image ? String(row.car_image) : null,
      resUpdatedAt: row.res_updated ? String(row.res_updated) : null,
    };
  }
  return map;
}

function toSummary(row: RaceJoinRow, lanes: LaneOccupancy[]): RaceSummary {
  const occupied = lanes.filter((l) => l.reservationId !== null).length;
  const confirmed = lanes.filter((l) => l.reservationStatus === 'confirmed').length;
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    eventName: row.event_name ? String(row.event_name) : undefined,
    raceNumber: Number(row.race_number),
    status: String(row.status),
    isActive: Number(row.is_active) === 1,
    winnerLane: row.winner_lane === null ? null : Number(row.winner_lane),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    occupied,
    confirmed,
    freeLanes: LANES_PER_RACE - occupied,
    lanes,
    updatedAt: String(row.updated_at),
  };
}

export function computeVersion(summary: RaceSummary): string {
  const laneStamp = summary.lanes
    .map((l) => `${l.reservationId ?? 0}:${l.reservationStatus ?? '-'}:${l.resUpdatedAt ?? ''}`)
    .join('|');
  return `${summary.updatedAt}#${laneStamp}`;
}

export async function listRaces(
  eventId?: number,
  opts: { includeContact?: boolean; statuses?: string[] } = {}
): Promise<RaceSummary[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (eventId !== undefined) {
    where.push('r.event_id = ?');
    params.push(eventId);
  }
  if (opts.statuses && opts.statuses.length > 0) {
    where.push(`r.status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT r.*, e.name AS event_name
     FROM races r JOIN events e ON e.id = r.event_id
     ${whereSql} ORDER BY r.race_number ASC`,
    params
  );
  const raceRows = rows as unknown as RaceJoinRow[];
  const occupancy = await loadOccupancy(raceRows.map((r) => r.id), opts.includeContact ?? false);
  return raceRows.map((r) => toSummary(r, occupancy.get(r.id) ?? emptyLanes()));
}

export async function getRaceSummary(raceId: number, includeContact: boolean): Promise<RaceSummary> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT r.*, e.name AS event_name
     FROM races r JOIN events e ON e.id = r.event_id WHERE r.id = ?`,
    [raceId]
  );
  const row = (rows as unknown as RaceJoinRow[])[0];
  if (!row) throw notFound('Carrera no encontrada');
  const occupancy = await loadOccupancy([raceId], includeContact);
  return toSummary(row, occupancy.get(raceId) ?? emptyLanes());
}

async function getRaceRow(raceId: number): Promise<RaceRow | null> {
  return queryOne<RaceRow>('SELECT * FROM races WHERE id = ?', [raceId]);
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export async function createRace(
  eventId: number,
  opts: { raceNumber?: number; isActive?: boolean },
  ctx: { adminId?: number | null; ip?: string | null }
): Promise<RaceSummary> {
  const event = await queryOne<Row>('SELECT id, status FROM events WHERE id = ?', [eventId]);
  if (!event) throw notFound('Evento no encontrado');
  if (String(event.status) === 'archived') {
    throw new ApiError(409, 'EVENT_ARCHIVED', 'El evento está archivado');
  }

  let raceNumber = opts.raceNumber;
  if (raceNumber === undefined) {
    const maxRow = await queryOne<Row>(
      'SELECT COALESCE(MAX(race_number), 0) AS maxn FROM races WHERE event_id = ?',
      [eventId]
    );
    raceNumber = Number(maxRow?.maxn ?? 0) + 1;
  }

  let raceId: number;
  try {
    const result = await query<Row>(
      'INSERT INTO races (event_id, race_number, status, is_active) VALUES (?, ?, ?, ?)',
      [eventId, raceNumber, 'open', opts.isActive ? 1 : 0]
    );
    raceId = Number((result as { insertId: number }).insertId);
  } catch (error) {
    if (isDuplicate(error)) {
      throw new ApiError(409, 'RACE_NUMBER_TAKEN', 'Ese número de carrera ya existe en la jornada');
    }
    throw error;
  }

  if (opts.isActive) {
    await tx(async (conn) => {
      await conn.query('UPDATE races SET is_active = 0 WHERE is_active = 1 AND id <> ?', [raceId]);
    });
  }

  await logAudit({
    adminId: ctx.adminId,
    action: 'race.create',
    entity: 'race',
    entityId: raceId,
    details: { eventId, raceNumber },
    ip: ctx.ip,
  });
  return getRaceSummary(raceId, true);
}

export async function setRaceStatus(
  raceId: number,
  next: string,
  ctx: { adminId?: number | null; ip?: string | null }
): Promise<RaceSummary> {
  await tx(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, status, winner_lane FROM races WHERE id = ? FOR UPDATE',
      [raceId]
    );
    const race = (rows as unknown as RaceRow[])[0];
    if (!race) throw notFound('Carrera no encontrada');
    assertRaceTransition(String(race.status), next);

    if (next === 'cancelled') {
      
      await conn.query(
        `UPDATE reservations SET status = 'cancelled' WHERE race_id = ? AND status IN ${ACTIVE_SQL}`,
        [raceId]
      );
    }
    if (next === 'open' && race.winner_lane !== null) {
      
      await conn.query('DELETE FROM race_results WHERE race_id = ?', [raceId]);
      await conn.query('UPDATE races SET winner_lane = NULL, finished_at = NULL WHERE id = ?', [raceId]);
    }
    await conn.query('UPDATE races SET status = ? WHERE id = ?', [next, raceId]);
  });

  await logAudit({
    adminId: ctx.adminId,
    action: 'race.status',
    entity: 'race',
    entityId: raceId,
    details: { to: next },
    ip: ctx.ip,
  });
  return getRaceSummary(raceId, true);
}

export async function setActiveRace(
  raceId: number,
  ctx: { adminId?: number | null; ip?: string | null }
): Promise<void> {
  await tx(async (conn) => {
    const [rows] = await conn.query('SELECT id, status FROM races WHERE id = ? FOR UPDATE', [raceId]);
    const race = (rows as unknown as RaceRow[])[0];
    if (!race) throw notFound('Carrera no encontrada');
    if (!['open', 'running', 'finished'].includes(String(race.status))) {
      throw new ApiError(409, 'RACE_NOT_SELECTABLE', 'Solo carreras en juego o finalizadas pueden mostrarse en streaming');
    }
    await conn.query('UPDATE races SET is_active = 0 WHERE is_active = 1');
    await conn.query('UPDATE races SET is_active = 1 WHERE id = ?', [raceId]);
  });
  await logAudit({
    adminId: ctx.adminId,
    action: 'race.set_active',
    entity: 'race',
    entityId: raceId,
    ip: ctx.ip,
  });
}


export async function ensureNextRace(
  eventId: number,
  ctx: { adminId?: number | null; ip?: string | null }
): Promise<number | null> {
  return tx(async (conn) => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT r.id,
              (SELECT COUNT(*) FROM reservations res WHERE res.race_id = r.id AND res.status IN ${ACTIVE_SQL}) AS occupied
       FROM races r WHERE r.event_id = ? AND r.status = 'open' ORDER BY r.race_number`,
      [eventId]
    );
    const open = rows as unknown as { id: number; occupied: number }[];
    const available = open.find((r) => Number(r.occupied) < LANES_PER_RACE);
    if (available) return Number(available.id);

    const [maxRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT COALESCE(MAX(race_number), 0) AS maxn FROM races WHERE event_id = ?',
      [eventId]
    );
    const maxn = Number((maxRows as unknown as { maxn: number }[])[0].maxn);
    const [insertResult] = await conn.query(
      "INSERT INTO races (event_id, race_number, status, is_active) VALUES (?, ?, 'open', 0)",
      [eventId, maxn + 1]
    );
    const newId = Number((insertResult as mysql.ResultSetHeader).insertId);
    await logAudit({
      adminId: ctx.adminId ?? null,
      action: 'race.create',
      entity: 'race',
      entityId: newId,
      details: { auto: true, raceNumber: maxn + 1, eventId },
      ip: ctx.ip ?? null,
    });
    return newId;
  });
}

export async function nextRaceSummary(
  eventId: number,
  excludeRaceId?: number
): Promise<{ id: number; raceNumber: number; freeLanes: number } | null> {
  const open = await listRaces(eventId, { statuses: ['open'] });
  const candidate = open.find((r) => r.id !== excludeRaceId && r.freeLanes > 0);
  return candidate
    ? { id: candidate.id, raceNumber: candidate.raceNumber, freeLanes: candidate.freeLanes }
    : null;
}

async function getActiveRaceId(): Promise<number | null> {
  const active = await queryOne<Row>('SELECT id FROM races WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1');
  if (active) return Number(active.id);

  const fallback = await queryOne<Row>(
    `SELECT r.id FROM races r JOIN events e ON e.id = r.event_id
     WHERE e.is_current = 1 AND r.status IN ('open','running')
     ORDER BY r.race_number ASC LIMIT 1`
  );
  return fallback ? Number(fallback.id) : null;
}


export async function buildStreamPayload(explicitRaceId?: number): Promise<StreamPayload | null> {
  let raceId: number | undefined = explicitRaceId;
  if (!raceId) raceId = (await getActiveRaceId()) ?? undefined;
  if (!raceId) return null;

  const race = await getRaceSummary(raceId, false);
  const [nextRace, settings] = await Promise.all([
    nextRaceSummary(race.eventId, race.id),
    getSettings(),
  ]);
  return {
    event: { id: race.eventId, name: race.eventName ?? '' },
    race,
    nextRace,
    version: computeVersion(race),
    pollMs: settings.streamPollMs,
  };
}

export { getRaceRow };
