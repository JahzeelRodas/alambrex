import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors';
import { query, queryOne, type Row } from '../database/pool';

export interface AdminSession {
  sessionId: string;
  csrfToken: string;
  admin: { id: number; username: string; displayName: string | null };
}

export interface SessionRow {
  id: string;
  admin_id: number;
  csrf_token: string;
  username: string;
  display_name: string | null;
  is_active: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    adminSession?: AdminSession;
  }
}

export const SESSION_COOKIE = 'hw_sess';
const SESSION_TTL_MS = 1000 * 60 * 60 * Number(process.env.SESSION_TTL_HOURS || 12);


export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}


export async function resolveSession(req: Request): Promise<AdminSession | undefined> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token || token.length !== 64) return undefined;

  const row = await queryOne<SessionRow>(
    `SELECT s.id, s.admin_id, s.csrf_token, s.expires_at, a.username, a.display_name, a.is_active
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  if (!row || Number(row.is_active) !== 1) return undefined;

  return {
    sessionId: String(row.id),
    csrfToken: String(row.csrf_token),
    admin: { id: Number(row.admin_id), username: row.username, displayName: row.display_name },
  };
}


export function attachSession(req: Request, _res: Response, next: NextFunction): void {
  resolveSession(req)
    .then((session) => {
      if (session) req.adminSession = session;
      next();
    })
    .catch(next);
}


export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.adminSession) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Autenticación requerida'));
    return;
  }
  next();
}


export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const session = req.adminSession;
  if (!session) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Autenticación requerida'));
    return;
  }
  const header = String(req.headers['x-csrf-token'] ?? '');
  if (!header || !safeEqual(header, session.csrfToken)) {
    next(new ApiError(403, 'CSRF', 'Token CSRF inválido'));
    return;
  }
  next();
}

export async function createSession(
  adminId: number,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<{ cookieToken: string; csrfToken: string }> {
  const cookieToken = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  await query(
    `INSERT INTO sessions (id, admin_id, csrf_token, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${SESSION_TTL_MS / 3_600_000} HOUR))`,
    [hashToken(cookieToken), adminId, csrfToken, ip ?? null, (userAgent ?? '').slice(0, 255)]
  );
  return { cookieToken, csrfToken };
}

export async function destroySession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE id = ?', [sessionId]);
}


export async function pruneSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at < NOW()');
}
