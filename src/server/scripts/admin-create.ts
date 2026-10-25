import { env } from '../config/env';
import { createAdmin } from '../modules/auth/service';
import { closePool } from '../database/pool';

/**
 * Crea el primer administrador (o uno adicional).
 * Uso:
 *   npm run admin:create -- --user admin --pass "ContraseñaSegura123"
 * También acepta ADMIN_USERNAME / ADMIN_PASSWORD por variables de entorno.
 */
function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function run(): Promise<void> {
  const username = argValue('--user') ?? process.env.ADMIN_USERNAME;
  const password = argValue('--pass') ?? process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Uso: npm run admin:create -- --user <usuario> --pass "<contraseña>"');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres');
    process.exitCode = 1;
    return;
  }

  await createAdmin(username, password);
  console.log(`[admin:create] administrador "${username}" creado correctamente`);
}

run()
  .catch((error) => {
    console.error('[admin:create] ERROR:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => undefined));
