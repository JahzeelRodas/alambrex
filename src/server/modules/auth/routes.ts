import { z } from 'zod';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errors';
import { createLimiter } from '../../middleware/rateLimit';
import { env } from '../../config/env';
import { authenticate } from './service';
import {
  createSession,
  destroySession,
  pruneSessions,
  SESSION_COOKIE,
  requireAdmin,
} from '../../middleware/session';
import { logAudit } from '../audit/service';

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(255),
});

const loginLimiter = createLimiter({ windowMs: env.rate.windowMs, max: env.rate.loginMax, key: 'login' });

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter.middleware,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    await pruneSessions();
    const admin = await authenticate(body.username, body.password);
    const { cookieToken, csrfToken } = await createSession(
      admin.id,
      req.ip,
      req.headers['user-agent']
    );
    await logAudit({ adminId: admin.id, action: 'auth.login', ip: req.ip });

    res
      .cookie(SESSION_COOKIE, cookieToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure,
        path: '/',
        maxAge: env.sessionTtlHours * 3600 * 1000,
      })
      .json({
        admin: { id: admin.id, username: admin.username, displayName: admin.display_name },
        csrfToken,
      });
  })
);

authRouter.post(
  '/logout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (req.adminSession) {
      await destroySession(req.adminSession.sessionId);
      await logAudit({ adminId: req.adminSession.admin.id, action: 'auth.logout', ip: req.ip });
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' }).json({ ok: true });
  })
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.adminSession) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sin sesión activa' } });
      return;
    }
    const { admin, csrfToken } = req.adminSession;
    res.json({ admin, csrfToken });
  })
);
