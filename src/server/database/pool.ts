import mysql from 'mysql2/promise';
import { env } from '../config/env';


export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 20,
  decimalNumbers: true,
  charset: 'utf8mb4_unicode_ci',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
});

export type Row = Record<string, unknown>;
export type Conn = mysql.PoolConnection | mysql.Pool;

export async function query<T = Row>(sql: string, params: unknown[] = [], conn?: Conn): Promise<T> {
  const executor = conn ?? pool;
  const [rows] = await executor.query(sql, params);
  return rows as T;
}

export async function queryOne<T = Row>(sql: string, params: unknown[] = [], conn?: Conn): Promise<T | null> {
  const rows = await query<T[]>(sql, params, conn);
  return rows.length > 0 ? rows[0] : null;
}


export async function tx<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}


export async function dbHealthy(): Promise<boolean> {
  try {
    await query('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
