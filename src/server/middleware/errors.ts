import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Recurso no encontrado') => new ApiError(404, 'NOT_FOUND', message);


export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }


  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Cuerpo JSON inválido' } });
    return;
  }


  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'La imagen supera el tamaño permitido' } });
    return;
  }

  console.error('[error]', err instanceof Error ? err.stack : err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: isProd ? 'Error interno del servidor' : String(err instanceof Error ? err.message : err),
    },
  });
}
