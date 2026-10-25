import { createApp } from './app';
import { env } from './config/env';
import { runMigrations } from './database/migrate';
import { closePool } from './database/pool';

async function main(): Promise<void> {
  // Migraciones opcionales al arrancar (AUTO_MIGRATE=true) para entornos sin SSH.
  if (env.autoMigrate) {
    try {
      await runMigrations();
    } catch (error) {
      console.error('[server] AUTO_MIGRATE falló:', error instanceof Error ? error.message : error);
      console.error('[server] la app continúa; ejecuta `npm run migrate` cuando la BD esté disponible');
    }
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] ALANBREX Carreras HW escuchando en el puerto ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[server] ${signal} recibido; cerrando...`);
    server.close(() => {
      closePool()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
    // Salida forzada si las conexiones no terminan a tiempo.
    setTimeout(() => process.exit(0), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[server] uncaughtException:', err);
    shutdown('uncaughtException');
  });
}

void main();
