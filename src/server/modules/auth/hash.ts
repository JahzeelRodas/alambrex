import crypto from 'node:crypto';


export function hashPassword(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
