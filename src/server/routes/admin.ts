import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../middleware/errors';
import { requireAdmin, requireCsrf } from '../middleware/session';
import { getDashboard } from '../modules/dashboard/service';
import * as settings from '../modules/settings/service';
import { listAudit } from '../modules/audit/service';
import { authRouter } from '../modules/auth/routes';
import { eventsRouter } from '../modules/events/routes';
import { carsRouter } from '../modules/cars/routes';
import { racesRouter } from '../modules/races/routes';
import { reservationsRouter } from '../modules/reservations/routes';
import { paymentsRouter } from '../modules/payments/routes';

const settingSchema = z.object({
  key: z.enum([
    'whatsapp_number',
    'reservation_expiry_minutes',
    'entry_price',
    'stream_poll_ms',
    'admin_poll_ms',
    'availability_poll_ms',
  ]),
  value: z.string().min(1).max(500),
});


export function buildAdminRouter(): Router {
  const admin = Router();

  admin.use('/auth', authRouter);


  admin.get(
    '/dashboard',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      res.json(await getDashboard());
    })
  );


  admin.get(
    '/audit',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const action = req.query.action ? String(req.query.action) : undefined;
      res.json(await listAudit({ limit, offset, action }));
    })
  );


  admin.get(
    '/settings',
    requireAdmin,
    asyncHandler(async (_req, res) => {
      res.json(await settings.getSettings(true));
    })
  );

  admin.put(
    '/settings',
    requireAdmin,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const body = settingSchema.parse(req.body);
      await settings.setSetting(body.key, body.value);
      res.json(await settings.getSettings(true));
    })
  );

  admin.use('/events', eventsRouter);
  admin.use('/cars', carsRouter);
  admin.use('/races', racesRouter);
  admin.use('/reservations', reservationsRouter);
  admin.use('/reservations', paymentsRouter);

  return admin;
}
