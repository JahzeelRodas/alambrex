import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/server/modules/auth/hash';

describe('hashPassword / verifyPassword', () => {
  it('el hash es verificable con la contraseña correcta', () => {
    const hash = hashPassword('ContraseñaSegura123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('ContraseñaSegura123', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const hash = hashPassword('ContraseñaSegura123');
    expect(verifyPassword('incorrecta', hash)).toBe(false);
  });

  it('genera sales distintas para la misma contraseña', () => {
    const a = hashPassword('misma-clave');
    const b = hashPassword('misma-clave');
    expect(a).not.toBe(b);
    expect(verifyPassword('misma-clave', a)).toBe(true);
    expect(verifyPassword('misma-clave', b)).toBe(true);
  });

  it('rechaza formatos corruptos sin lanzar', () => {
    expect(verifyPassword('x', 'formato-basura')).toBe(false);
    expect(verifyPassword('x', 'md5$1$2$3$4$5')).toBe(false);
  });
});
