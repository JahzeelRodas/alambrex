import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errors';
import { requireAdmin, requireCsrf } from '../../middleware/session';
import { logAudit } from '../audit/service';
import * as races from './service';
import * as results from '../results/service';

export const racesRouter = Router();

const createSchema = z.object({
  eventId: z.number().int().positive(),
  raceNumber: z.number().int().positive().max(9999).optional(),
  isActive: z.boolean().optional(),
});

const statusSchema = z.object({
  status: z.enum(['pending', 'open', 'running', 'finished', 'cancelled']),
});

const winnerSchema = z.object({
  lane: z.number().int().min(1).max(6),
});

racesRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
    const statuses = req.query.statuses ? String(req.query.statuses).split(',') : undefined;
    res.json({ races: await races.listRaces(eventId, { includeContact: true, statuses }) });
  })
);

racesRouter.post(
  '/',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const race = await races.createRace(
      body.eventId,
      { raceNumber: body.raceNumber, isActive: body.isActive },
      { adminId: req.adminSession?.admin.id, ip: req.ip }
    );
    res.status(201).json({ race });
  })
);

racesRouter.patch(
  '/:id/status',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = statusSchema.parse(req.body);
    const race = await races.setRaceStatus(id, body.status, {
      adminId: req.adminSession?.admin.id,
      ip: req.ip,
    });
    res.json({ race });
  })
);

racesRouter.post(
  '/:id/active',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await races.setActiveRace(id, { adminId: req.adminSession?.admin.id, ip: req.ip });
    res.json({ ok: true });
  })
);


racesRouter.post(
  '/:id/winner',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = winnerSchema.parse(req.body);
    await results.registerWinner(id, body.lane, {
      adminId: req.adminSession?.admin.id ?? null,
      ip: req.ip,
    });
    const race = await races.getRaceSummary(id, true);
    res.json({ race });
  })
);


racesRouter.delete(
  '/:id/winner',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await results.clearWinner(id, {
      adminId: req.adminSession?.admin.id ?? null,
      ip: req.ip,
    });
    const race = await races.getRaceSummary(id, true);
    res.json({ race });
  })
);
