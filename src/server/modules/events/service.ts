import { ApiError } from '../../middleware/errors';
import { query, queryOne, type Row } from '../../database/pool';

export interface EventRow {
  id: number;
  name: string;
  description: string | null;
  status: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

export async function listEvents(): Promise<EventRow[]> {
  return query<EventRow[]>('SELECT * FROM events ORDER BY is_current DESC, created_at DESC');
}

export async function getCurrentEvent(): Promise<EventRow | null> {
  return queryOne<EventRow>(
    'SELECT * FROM events WHERE is_current = 1 ORDER BY created_at DESC LIMIT 1'
  );
}

export async function getEvent(id: number): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT * FROM events WHERE id = ?', [id]);
}

export async function createEvent(name: string, description: string | null): Promise<EventRow> {
  const result = await query<Row>(
    'INSERT INTO events (name, description, status) VALUES (?, ?, ?)',
    [name, description, 'active']
  );
  const id = Number((result as { insertId: number }).insertId);
 
  const anyCurrent = await queryOne<Row>('SELECT id FROM events WHERE is_current = 1 LIMIT 1');
  if (!anyCurrent) {
    await query('UPDATE events SET is_current = 1 WHERE id = ?', [id]);
  }
  const event = await getEvent(id);
  if (!event) throw new ApiError(500, 'INTERNAL', 'No se pudo crear el evento');
  return event;
}

export async function updateEvent(
  id: number,
  patch: { name?: string; description?: string | null; status?: string }
): Promise<EventRow | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    params.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push('description = ?');
    params.push(patch.description);
  }
  if (patch.status !== undefined) {
    fields.push('status = ?');
    params.push(patch.status);
  }
  if (fields.length === 0) return getEvent(id);
  params.push(id);
  await query(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, params);
  return getEvent(id);
}
