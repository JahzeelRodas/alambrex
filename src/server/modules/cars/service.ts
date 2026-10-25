import { ApiError } from '../../middleware/errors';
import { query, queryOne, type Row } from '../../database/pool';

export interface CarRow {
  id: number;
  name: string;
  model: string | null;
  color: string | null;
  image_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CarInput {
  name: string;
  model: string | null;
  color: string | null;
  imageUrl: string | null;
}

export async function listCars(includeInactive: boolean): Promise<CarRow[]> {
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  return query<CarRow[]>(`SELECT * FROM cars ${where} ORDER BY is_active DESC, name ASC`);
}

export async function getCar(id: number): Promise<CarRow | null> {
  return queryOne<CarRow>('SELECT * FROM cars WHERE id = ?', [id]);
}

export async function createCar(input: CarInput): Promise<CarRow> {
  try {
    const result = await query<Row>(
      'INSERT INTO cars (name, model, color, image_url) VALUES (?, ?, ?, ?)',
      [input.name, input.model, input.color, input.imageUrl]
    );
    const id = Number((result as { insertId: number }).insertId);
    const car = await getCar(id);
    if (!car) throw new ApiError(500, 'INTERNAL', 'No se pudo crear el coche');
    return car;
  } catch (error) {
    if (isDuplicateError(error)) {
      throw new ApiError(409, 'CAR_EXISTS', 'Ya existe un coche con ese nombre');
    }
    throw error;
  }
}

export async function updateCar(
  id: number,
  patch: { name?: string; model?: string | null; color?: string | null; image_url?: string | null; is_active?: boolean }
): Promise<CarRow | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    params.push(patch.name);
  }
  if (patch.model !== undefined) {
    fields.push('model = ?');
    params.push(patch.model);
  }
  if (patch.color !== undefined) {
    fields.push('color = ?');
    params.push(patch.color);
  }
  if (patch.image_url !== undefined) {
    fields.push('image_url = ?');
    params.push(patch.image_url);
  }
  if (patch.is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(patch.is_active ? 1 : 0);
  }
  if (fields.length === 0) return getCar(id);
  params.push(id);
  try {
    await query(`UPDATE cars SET ${fields.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (isDuplicateError(error)) {
      throw new ApiError(409, 'CAR_EXISTS', 'Ya existe un coche con ese nombre');
    }
    throw error;
  }
  return getCar(id);
}

export async function deleteCar(id: number): Promise<{ deleted: boolean; deactivated: boolean }> {
  const refs = await queryOne<Row>('SELECT COUNT(*) AS total FROM reservations WHERE car_id = ?', [id]);
  const referenced = Number(refs?.total ?? 0) > 0;
  if (!referenced) {
    await query('DELETE FROM cars WHERE id = ?', [id]);
    return { deleted: true, deactivated: false };
  }

  await query('UPDATE cars SET is_active = 0 WHERE id = ?', [id]);
  return { deleted: false, deactivated: true };
}

function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}
