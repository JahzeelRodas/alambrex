import { env } from '../../config/env';
import { query, queryOne, type Row } from '../../database/pool';

const KEYS = [
  'whatsapp_number',
  'reservation_expiry_minutes',
  'entry_price',
  'stream_poll_ms',
  'admin_poll_ms',
  'availability_poll_ms',
  'stream_url',
] as const;

export type SettingKey = (typeof KEYS)[number];

export type AppSettings = {
  whatsappNumber: string;
  reservationExpiryMinutes: number;
  entryPrice: number;
  streamPollMs: number;
  adminPollMs: number;
  availabilityPollMs: number;
  streamUrl?: string;
};

interface CacheEntry {
  at: number;
  settings: AppSettings;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5000;

function defaults(): AppSettings {
  return {
    whatsappNumber: env.whatsappNumber,
    reservationExpiryMinutes: env.reservationExpiryMinutes,
    entryPrice: env.entryPrice,
    streamPollMs: 2000,
    adminPollMs: 4000,
    availabilityPollMs: 5000,
    streamUrl: '',
  };
}


export async function getSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings;

  const base = defaults();
  const rows = await query<Row[]>('SELECT setting_key, setting_value FROM settings');
  const map = new Map(rows.map((r) => [String(r.setting_key), String(r.setting_value)]));

  const settings: AppSettings = {
    whatsappNumber: map.get('whatsapp_number')?.trim() || base.whatsappNumber,
    reservationExpiryMinutes: toInt(map.get('reservation_expiry_minutes'), base.reservationExpiryMinutes),
    entryPrice: toInt(map.get('entry_price'), base.entryPrice),
    streamPollMs: toInt(map.get('stream_poll_ms'), base.streamPollMs),
    adminPollMs: toInt(map.get('admin_poll_ms'), base.adminPollMs),
    availabilityPollMs: toInt(map.get('availability_poll_ms'), base.availabilityPollMs),
    streamUrl: map.get('stream_url')?.trim() || base.streamUrl,
  };

  cache = { at: Date.now(), settings };
  return settings;
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  if (!(KEYS as readonly string[]).includes(key)) {
    throw new Error(`Ajuste desconocido: ${key}`);
  }
  await query(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, value]
  );
  cache = null;
}

export async function getSettingRaw(key: SettingKey): Promise<string | null> {
  const row = await queryOne<Row>('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
  return row ? String(row.setting_value) : null;
}

export function invalidateSettingsCache(): void {
  cache = null;
}