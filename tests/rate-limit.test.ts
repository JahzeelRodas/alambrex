import { describe, expect, it } from 'vitest';
import { createLimiter, createMemoryStore } from '../src/server/middleware/rateLimit';
import { ApiError } from '../src/server/middleware/errors';

interface FakeReq {
  ip?: string;
}
type Next = (err?: unknown) => void;

function call(limiter: ReturnType<typeof createLimiter>, ip: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const next: Next = (err) => (err ? reject(err) : resolve());
    limiter.middleware({ ip } as unknown as Parameters<typeof limiter.middleware>[0], {} as never, next);
  });
}

describe('createLimiter', () => {
  it('permite hasta max solicitudes por ventana', async () => {
    let now = 0;
    const store = createMemoryStore();
    const limiter = createLimiter({ windowMs: 1000, max: 3, key: 'test' }, store, () => now);

    await call(limiter, '1.1.1.1');
    await call(limiter, '1.1.1.1');
    await call(limiter, '1.1.1.1');
    await expect(call(limiter, '1.1.1.1')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    } satisfies Partial<ApiError>);
  });

  it('reinicia la ventana al vencer', async () => {
    let now = 0;
    const store = createMemoryStore();
    const limiter = createLimiter({ windowMs: 1000, max: 2, key: 'test' }, store, () => now);

    await call(limiter, '2.2.2.2');
    await call(limiter, '2.2.2.2');
    await expect(call(limiter, '2.2.2.2')).rejects.toBeDefined();

    now = 1500; // ventana vencida
    await expect(call(limiter, '2.2.2.2')).resolves.toBeUndefined();
  });

  it('separa límites por IP', async () => {
    const store = createMemoryStore();
    const limiter = createLimiter({ windowMs: 1000, max: 1, key: 'test' }, store, () => 0);

    await call(limiter, '3.3.3.3');
    await expect(call(limiter, '3.3.3.3')).rejects.toBeDefined();
    await expect(call(limiter, '4.4.4.4')).resolves.toBeUndefined();
  });
});
