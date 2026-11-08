import { z } from 'zod';
import { Router } from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { asyncHandler } from '../../middleware/errors';
import { requireAdmin, requireCsrf } from '../../middleware/session';
import { logAudit } from '../audit/service';
import { paymentImagesDir } from '../../config/uploads';
import { getSettingRaw, setSetting } from './service';

export const settingsRouter = Router();



async function removePreviousQr(value: string | null): Promise<void> {
  // El QR anterior queda huérfano tras subir uno nuevo; se elimina con
  // best-effort (un fallo de disco no debe impedir la nueva subida).
  if (!value || !value.startsWith('/uploads/payment/')) return;
  const filename = path.basename(value);
  try {
    await fs.promises.unlink(path.join(paymentImagesDir(), filename));
  } catch {
    // noop
  }
}

settingsRouter.post(
  '/payment-qr',
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

    const previousUrl = await getSettingRaw('payment_qr_url');

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const dir = paymentImagesDir();
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `payment-qr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    await fs.promises.writeFile(path.join(dir, filename), buffer);

    const url = `/uploads/payment/${filename}`;
    await setSetting('payment_qr_url', url);
    await removePreviousQr(previousUrl);

    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'settings.payment_qr_upload',
      entity: 'settings',
      details: { filename, bytes: buffer.length },
      ip: req.ip,
    });
    res.status(201).json({ url });
  })
);

settingsRouter.delete(
  '/payment-qr',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const previousUrl = await getSettingRaw('payment_qr_url');
    await setSetting('payment_qr_url', '');
    await removePreviousQr(previousUrl);

    await logAudit({
      adminId: req.adminSession?.admin.id,
      action: 'settings.payment_qr_remove',
      entity: 'settings',
      ip: req.ip,
    });
    res.json({ ok: true });
  })
);
