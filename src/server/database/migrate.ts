import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env } from '../config/env';
import { query } from './pool';

interface MigrationRow {
  name: string;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database', 'migrations');


export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  const push = (): void => {
    const trimmed = current.trim();
    if (trimmed.length > 0) statements.push(trimmed);
    current = '';
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {

      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      current += ch;
      i++;
      while (i < sql.length) {
        const c = sql[i];
        if (c === '\\' && quote !== '`') {
          current += c + (sql[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (c === quote) {
          if (sql[i + 1] === quote) {
            current += c + c;
            i += 2;
            continue;
          }
          current += c;
          i++;
          break;
        }
        current += c;
        i++;
      }
      continue;
    }
    if (ch === ';') {
      push();
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  push();
  return statements;
}


export async function runMigrations(): Promise<string[]> {

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
  });

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

    const [appliedRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT name FROM schema_migrations ORDER BY name'
    );
    const applied = new Set(appliedRows.map((r) => String(r.name)));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));
    const executed: string[] = [];

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = splitSqlStatements(sql);

      for (let index = 0; index < statements.length; index++) {
        const stmt = statements[index];
        try {
          await conn.query(stmt);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Migración ${file}, sentencia ${index + 1}/${statements.length}: ${detail}`
          );
        }
      }
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      executed.push(file);
      console.log(`[migrate] aplicada: ${file}`);
    }

    if (executed.length === 0) {
      console.log('[migrate] no hay migraciones pendientes');
    }
    return executed;
  } finally {
    await conn.end();
  }
}


if (require.main === module) {
  runMigrations()
    .then((executed) => {
      console.log(
        executed.length > 0
          ? `[migrate] ${executed.length} migración(es) aplicadas correctamente`
          : '[migrate] esquema al día'
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error('[migrate] ERROR:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
