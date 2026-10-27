import { Router } from 'express';
import { asyncHandler } from '../../middleware/errors';
import * as results from './service';

export const resultsRouter = Router();


resultsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    res.json({ results: await results.recentResults(limit) });
  })
);
