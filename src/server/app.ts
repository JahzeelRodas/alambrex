import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { buildApiRouter } from './routes';
import { attachSession } from './middleware/session';
import { errorHandler } from './middleware/errors';
import { UPLOADS_DIR } from './config/uploads';

const CLIENT_DIST = path.resolve(process.cwd(), 'dist', 'client');

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Tras el proxy de Hostinger, req.ip refleja la IP real del visitante.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // SPA con estilos inline de Tailwind + captura en OBS: CSP básica desactivada.
      // El resto de cabeceras de helmet siguen activas.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // La subida de imágenes viaja como JSON base64 y necesita un límite mayor que
  // el habitual: se aplica solo a esa ruta y no muta el límite global.
  const slimJson = express.json({ limit: '100kb' });
  const imageJson = express.json({ limit: '4mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/admin/cars/image') {
      imageJson(req, res, next);
      return;
    }
    slimJson(req, res, next);
  });

  // Imágenes subidas en tiempo de ejecución (persisten entre builds).
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Resuelve la sesión administrativa (cookie httpOnly) en cada solicitud.
  app.use(attachSession);

  app.use('/api', buildApiRouter());

  if (fs.existsSync(CLIENT_DIST)) {
    // Estáticos del frontend compilado (dist/client) + assets con caché.
    app.use(
      express.static(CLIENT_DIST, {
        index: 'index.html',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    // Fallback SPA sin interceptar /api.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
