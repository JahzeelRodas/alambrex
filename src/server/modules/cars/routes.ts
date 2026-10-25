import { z } from 'zod';
import { Router } from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { asyncHandler, notFound } from '../../middleware/errors';
import { requireAdmin, requireCsrf } from '../../middleware/session';
import { logAudit } from '../audit/service';
import { carImagesDir } from '../../config/uploads';
import * as cars from './service';

export const carsRouter = Router();

const carSchema = z.object({
  name: z.string().min(2).max(120),
  model: z.string().max(120).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
});

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  model: z.string().max(120).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});


carsRouter.post(
  '/image',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = z.object({ dataUrl: z.string().min(30).max(4_500_000) }).parse(req.body);

    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(body.dataUrl);
    if (!match) {
      res.status(400).json({
        error: { code: 'BAD_IMAGE', message: 'Formato no admitido. Usa JPG, PNG o WEBP.' },
      });
      return;
    }
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length < 100 || buffer.length > 3_000_000) {
      res.status(400).json({
        error: { code: 'BAD_IMAGE', message: 'La imagen debe pesar entre 100 B y 3 MB.' },
      });
      return;
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const dir = carImagesDir();
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `car-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    await fs.promises.writeFile(path.join(dir, filename), buffer);

    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'car.image_upload',
      entity: 'car',
      details: { filename, bytes: buffer.length },
      ip: req.ip,
    });
    res.status(201).json({ url: `/uploads/cars/${filename}` });
  })
);

carsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ cars: await cars.listCars(true) });
  })
);

carsRouter.post(
  '/',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = carSchema.parse(req.body);
    const car = await cars.createCar({
      name: body.name,
      model: body.model ?? null,
      color: body.color ?? null,
      imageUrl: body.image_url ?? null,
    });
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'car.create',
      entity: 'car',
      entityId: car.id,
      details: { name: car.name },
      ip: req.ip,
    });
    res.status(201).json({ car });
  })
);

carsRouter.patch(
  '/:id',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = patchSchema.parse(req.body);
    const car = await cars.updateCar(id, body);
    if (!car) throw notFound('Coche no encontrado');
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'car.update',
      entity: 'car',
      entityId: id,
      details: body,
      ip: req.ip,
    });
    res.json({ car });
  })
);


carsRouter.delete(
  '/:id',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await cars.deleteCar(id);
    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'car.delete',
      entity: 'car',
      entityId: id,
      details: result,
      ip: req.ip,
    });
    res.json(result);
  })
);
