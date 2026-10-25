import { Router } from 'express';
import { dbHealthy } from '../database/pool';
import { publicRouter } from './public';
import { buildAdminRouter } from './admin';


export function buildApiRouter(): Router {
  const api = Router();


  api.get('/health', async (_req, res) => {
    const db = await dbHealthy();
    res.status(200).json({ ok: true, db, time: new Date().toISOString() });
  });

  api.use('/public', publicRouter);
  api.use('/admin', buildAdminRouter());

  return api;
}
