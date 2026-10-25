import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

interface LimiterOptions {
  windowMs: number;
  max: number;

  key?: string;
}

export interface BucketStore {
  get(key: string): Bucket | undefined;
  set(key: string, bucket: Bucket): void;
  delete(key: string): void;
}


export function createMemoryStore(): BucketStore {
  const map = new Map<string, Bucket>();
  return {
    get: (k) => map.get(k),
    set: (k, b) => map.set(k, b),
    delete: (k) => {
      map.delete(k);
    },
  };
}

export interface Limiter {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  store: BucketStore;
}

export function createLimiter(options: LimiterOptions, store: BucketStore = createMemoryStore(), now: () => number = Date.now): Limiter {
  const { windowMs, max, key = 'global' } = options;

  function middleware(req: Request, _res: Response, next: NextFunction): void {
    const ip = req.ip ?? 'unknown';
    const bucketKey = `${key}:${ip}`;
    const current = now();
    const bucket = store.get(bucketKey);

    if (!bucket || bucket.resetAt <= current) {
      store.set(bucketKey, { count: 1, resetAt: current + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - current) / 1000));
      next(new ApiError(429, 'RATE_LIMITED', `Demasiadas solicitudes. Reintenta en ${retryAfterSec}s`));
      return;
    }
    next();
  }

  return { middleware, store };
}
