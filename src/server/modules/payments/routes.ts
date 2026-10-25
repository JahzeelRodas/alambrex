import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errors';
import { requireAdmin, requireCsrf } from '../../middleware/session';
import * as payments from './service';

export const paymentsRouter = Router();

const confirmSchema = z.object({
  method: z.enum(['transfer', 'cash', 'other']).default('transfer'),
  amount: z.number().nonnegative().nullable().optional(),
  reference: z.string().max(160).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

paymentsRouter.post(
  '/:id/confirm-payment',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = confirmSchema.parse(req.body);
    const result = await payments.confirmPayment(id, body, {
      adminId: req.adminSession?.admin.id ?? null,
      ip: req.ip,
    });
    res.json(result);
  })
);

paymentsRouter.post(
  '/:id/reactivate',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await payments.reactivate(id, {
      adminId: req.adminSession?.admin.id ?? null,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);

paymentsRouter.post(
  '/:id/cancel',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await payments.cancelReservation(id, {
      adminId: req.adminSession?.admin.id ?? null,
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);
