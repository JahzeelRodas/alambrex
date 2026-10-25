import dotenv from 'dotenv';
import path from 'node:path';

// Carga .env desde el directorio de trabajo (desarrollo). En Hostinger las
// variables se definen en el panel de la aplicación Node.js.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function str(value: string | undefined, fallback: string): string {
  return value !== undefined && value !== '' ? value : fallback;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

const nodeEnv = str(process.env.NODE_ENV, 'development');

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: num(process.env.PORT, 4000),

  db: {
    host: str(process.env.DB_HOST, '127.0.0.1'),
    port: num(process.env.DB_PORT, 3306),
    user: str(process.env.DB_USER, 'root'),
    password: str(process.env.DB_PASSWORD, ''),
    database: str(process.env.DB_NAME, 'carreras_hw'),
    connectionLimit: num(process.env.DB_CONNECTION_LIMIT, 5),
  },

  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 12),

  reservationExpiryMinutes: num(process.env.RESERVATION_EXPIRY_MINUTES, 30),
  whatsappNumber: str(process.env.WHATSAPP_NUMBER, ''),
  entryPrice: num(process.env.ENTRY_PRICE, 100),

  cookieSecure: bool(process.env.COOKIE_SECURE, nodeEnv === 'production'),

  autoMigrate: bool(process.env.AUTO_MIGRATE, false),

  rate: {
    windowMs: num(process.env.RATE_WINDOW_MS, 60_000),
    loginMax: num(process.env.RATE_LOGIN_MAX, 8),
    reservationMax: num(process.env.RATE_RESERVATION_MAX, 20),
  },
} as const;

export const LANES_PER_RACE = 6;
