import { pool, query, type Row } from '../../database/pool';

export interface AuditInput {
  adminId?: number | null;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  details?: unknown;
  ip?: string | null;
}

export interface AuditRow {
  id: number;
  action: string;
  entity: string | null;
  entity_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
  admin_username: string | null;
}


export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (admin_id, action, entity, entity_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.adminId ?? null,
        input.action,
        input.entity ?? null,
        input.entityId ?? null,
        input.details !== undefined ? JSON.stringify(input.details) : null,
        input.ip ?? null,
      ]
    );
  } catch (error) {
    console.error('[audit] no se pudo registrar:', error instanceof Error ? error.message : error);
  }
}


function detailsText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function listAudit(options: { limit: number; offset: number; action?: string }): Promise<{ rows: AuditRow[]; total: number }> {
  const { limit, offset, action } = options;
  const where = action ? 'WHERE action = ?' : '';
  const params = action ? [action] : [];
  const rows = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.ip, a.created_at,
            admin.username AS admin_username
     FROM audit_logs a LEFT JOIN admins admin ON admin.id = a.admin_id
     ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [totalRows] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
  return {
    rows: (rows[0] as unknown as { details: unknown }[]).map((r) => ({
      ...r,
      details: detailsText(r.details),
    })) as unknown as AuditRow[],
    total: Number((totalRows as Row[])[0]?.total ?? 0),
  };
}
