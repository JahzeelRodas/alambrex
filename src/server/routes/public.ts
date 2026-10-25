import { z } from 'zod';
import { Router } from 'express';
import { ApiError, asyncHandler } from '../middleware/errors';
import { createLimiter } from '../middleware/rateLimit';
import { env } from '../config/env';
import { getSettings } from '../modules/settings/service';
import * as events from '../modules/events/service';
import * as races from '../modules/races/service';
import * as carsService from '../modules/cars/service';
import * as reservations from '../modules/reservations/service';
import * as results from '../modules/results/service';
import { buildReservationMessage, buildWhatsAppUrl } from '../modules/reservations/logic';

export const publicRouter = Router();

const reservationLimiter = createLimiter({
  windowMs: env.rate.windowMs,
  max: env.rate.reservationMax,
  key: 'reservation',
});

const createSchema = z.object({
  raceId: z.number().int().positive(),
  lane: z.number().int().min(1).max(6),
  carId: z.number().int().positive(),
  participantName: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(5).max(160),
});


publicRouter.get(
  '/event',
  asyncHandler(async (_req, res) => {
    const [event, settings] = await Promise.all([events.getCurrentEvent(), getSettings()]);
    const raceList = event
      ? await races.listRaces(event.id, { statuses: ['open', 'running'] })
      : [];
    res.json({
      event: event
        ? { id: event.id, name: event.name, description: event.description, status: event.status }
        : null,
      races: raceList,
      price: settings.entryPrice,
      pollMs: settings.availabilityPollMs,
    });
  })
);


publicRouter.get(
  '/races/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const race = await races.getRaceSummary(id, false);
    res.json({ race });
  })
);


publicRouter.get(
  '/races/:id/stream',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const payload = await races.buildStreamPayload(id);
    if (!payload) throw new ApiError(404, 'NO_RACE', 'No hay carrera disponible');
    res.json(payload);
  })
);


publicRouter.get(
  '/stream',
  asyncHandler(async (_req, res) => {
    const payload = await races.buildStreamPayload();
    if (!payload) {
      res.json({ event: null, race: null, nextRace: null, version: 'empty', pollMs: 4000 });
      return;
    }
    res.json(payload);
  })
);


publicRouter.get(
  '/cars',
  asyncHandler(async (_req, res) => {
    const cars = await carsService.listCars(false);
    res.json({
      cars: cars.map((c) => ({
        id: c.id,
        name: c.name,
        model: c.model,
        color: c.color,
        image_url: c.image_url,
      })),
    });
  })
);


publicRouter.get(
  '/results',
  asyncHandler(async (_req, res) => {
    res.json({ results: await results.recentResults(10) });
  })
);


publicRouter.post(
  '/reservations',
  reservationLimiter.middleware,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const { token } = await reservations.createReservation(body, { ip: req.ip });

    const view = await reservations.getReservationByToken(token);
    if (!view) throw new ApiError(500, 'INTERNAL', 'No se pudo crear la inscripción');

    const settings = await getSettings();
    const message = buildReservationMessage({
      eventName: view.event.name,
      raceNumber: view.race.raceNumber,
      lane: view.lane,
      carName: view.carName,
      participantName: view.participantName,
      token,
      price: settings.entryPrice,
    });
    const whatsappUrl = settings.whatsappNumber
      ? buildWhatsAppUrl(settings.whatsappNumber, message)
      : null;

    res.status(201).json({ reservation: view, whatsappUrl });
  })
);


publicRouter.get(
  '/reservations/:token',
  asyncHandler(async (req, res) => {
    const view = await reservations.getReservationByToken(String(req.params.token));
    if (!view) throw new ApiError(404, 'NOT_FOUND', 'Inscripción no encontrada');
    let whatsappUrl: string | null = null;
    if (view.status === 'pending_payment') {
      const settings = await getSettings();
      if (settings.whatsappNumber) {
        const message = buildReservationMessage({
          eventName: view.event.name,
          raceNumber: view.race.raceNumber,
          lane: view.lane,
          carName: view.carName,
          participantName: view.participantName,
          token: view.token,
          price: settings.entryPrice,
        });
        whatsappUrl = buildWhatsAppUrl(settings.whatsappNumber, message);
      }
    }
    res.json({ reservation: view, whatsappUrl });
  })
);
