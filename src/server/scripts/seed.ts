import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env } from '../config/env';
import { closePool } from '../database/pool';

/** Ejecuta los archivos SQL de database/seeds en orden (idempotentes). */
async function runSeeds(): Promise<void> {
  const dir = path.resolve(process.cwd(), 'database', 'seeds');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('[seed] no hay semillas que aplicar');
    return;
  }

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: true,
  });

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await conn.query(sql);
      console.log(`[seed] aplicada: ${file}`);
    }
  } finally {
    await conn.end();
  }
}

runSeeds()
  .then(() => closePool())
  .catch((error) => {
    console.error('[seed] ERROR:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return closePool();
  });
