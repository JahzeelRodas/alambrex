import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errors';
import { requireAdmin } from '../../middleware/session';
import * as reservations from './service';

export const reservationsRouter = Router();

const listQuery = z.object({
  status: z.enum(['pending_payment', 'confirmed', 'expired', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

reservationsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = listQuery.parse(req.query);
    const result = await reservations.listAdmin(parsed);
    res.json(result);
  })
);
