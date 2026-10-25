import crypto from 'node:crypto';
import { ApiError } from '../../middleware/errors';
import { query, queryOne, type Row } from '../../database/pool';
import { hashPassword, verifyPassword } from './hash';

export interface AdminAccount {
  id: number;
  username: string;
  display_name: string | null;
  password_hash: string;
  is_active: number;
}

export async function createAdmin(username: string, password: string, displayName?: string): Promise<void> {
  const existing = await queryOne<Row>('SELECT id FROM admins WHERE username = ?', [username]);
  if (existing) {
    throw new ApiError(409, 'USER_EXISTS', `El administrador "${username}" ya existe`);
  }
  await query(
    'INSERT INTO admins (username, display_name, password_hash) VALUES (?, ?, ?)',
    [username, displayName ?? null, hashPassword(password)]
  );
}

export async function authenticate(username: string, password: string): Promise<AdminAccount> {
  const admin = await queryOne<AdminAccount>(
    'SELECT id, username, display_name, password_hash, is_active FROM admins WHERE username = ?',
    [username]
  );
  if (!admin || Number(admin.is_active) !== 1) {
    throw new ApiError(401, 'BAD_CREDENTIALS', 'Usuario o contraseña incorrectos');
  }
  if (!verifyPassword(password, admin.password_hash)) {
    throw new ApiError(401, 'BAD_CREDENTIALS', 'Usuario o contraseña incorrectos');
  }
  return admin;
}

export function newOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
