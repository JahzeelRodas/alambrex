import { z } from 'zod';
import { Router } from 'express';
import mysql from 'mysql2/promise';
import { ApiError, asyncHandler, notFound } from '../../middleware/errors';
import { requireAdmin, requireCsrf } from '../../middleware/session';
import { tx } from '../../database/pool';
import { logAudit } from '../audit/service';
import * as events from './service';
import * as races from '../races/service';

export const eventsRouter = Router();

const createSchema = z.object({
  name: z.string().min(3).max(140),
  description: z.string().max(500).nullable().optional(),
});

const patchSchema = z.object({
  name: z.string().min(3).max(140).optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
});

eventsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ events: await events.listEvents() });
  })
);

eventsRouter.post(
  '/',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const event = await events.createEvent(body.name, body.description ?? null);
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'event.create',
      entity: 'event',
      entityId: event.id,
      details: { name: event.name },
      ip: req.ip,
    });
    res.status(201).json({ event });
  })
);

eventsRouter.patch(
  '/:id',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = patchSchema.parse(req.body);
    const event = await events.updateEvent(id, body);
    if (!event) throw notFound('Evento no encontrado');
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'event.update',
      entity: 'event',
      entityId: id,
      details: body,
      ip: req.ip,
    });
    res.json({ event });
  })
);


eventsRouter.post(
  '/:id/current',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await tx(async (conn) => {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT id, status FROM events WHERE id = ? FOR UPDATE',
        [id]
      );
      const row = (rows as unknown as events.EventRow[])[0];
      if (!row) throw notFound('Evento no encontrado');
      if (row.status === 'archived') {
        throw new ApiError(409, 'EVENT_ARCHIVED', 'No se puede activar un evento archivado');
      }
      await conn.query('UPDATE events SET is_current = 0 WHERE is_current = 1');
      await conn.query("UPDATE events SET is_current = 1, status = 'active' WHERE id = ?", [id]);
    });
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'event.set_current',
      entity: 'event',
      entityId: id,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);


eventsRouter.get(
  '/:id/races',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    res.json({ races: await races.listRaces(id, { includeContact: true }) });
  })
);
