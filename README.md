# Carreras Hot Wheels — ALANBREX

Plataforma de inscripción y administración de carreras Hot Wheels de **seis carriles**: selección de coches, reserva de carriles, confirmación manual de pagos por WhatsApp, organización de jornadas y carreras, registro de ganadores y pantalla pública para streaming en OBS Studio.

**Identidad visual:** diseño generado a partir de los logos oficiales de la marca (`logos/`) — fondo negro profundo, verde neón (#39FF14), patrones de circuito impreso, tipografía racing itálica (Exo 2 / Rajdhani / Share Tech Mono).

---

## 1. Stack y restricciones de infraestructura

Diseñado para **Hostinger Web Hosting / Cloud Hosting** (aplicación Node.js):

- Node.js 20 o 22 (configurable en el panel de Hostinger).
- Backend: Express + TypeScript (un único proceso).
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS 3.
- Base de datos: **MySQL/MariaDB** (InnoDB) con `mysql2/promise`.
- Comunicación HTTP: API REST. Actualización de pantallas: **polling HTTP** (sin WebSockets, sin Socket.IO).
- Pagos: solicitud por **WhatsApp Click to Chat**; confirmación manual por el administrador.
- Sin Docker, Redis, PostgreSQL, puertos personalizados ni procesos de fondo permanentes.

## 2. Estructura del proyecto

```
CarrerasHW/
├── src/
│   ├── server/                    # Backend Express (TypeScript)
│   │   ├── app.ts                 # App Express: helmet, JSON, API, estáticos, SPA
│   │   ├── server.ts              # Arranque (puerto process.env.PORT) y cierre graceful
│   │   ├── config/env.ts          # Lectura de variables de entorno
│   │   ├── database/              # pool mysql2 + migrador versionado
│   │   ├── middleware/            # errores, rate-limit, sesión, CSRF
│   │   ├── modules/
│   │   │   ├── auth/              # login/logout/me + hash scrypt
│   │   │   ├── events/            # jornadas
│   │   │   ├── cars/              # flota de coches
│   │   │   ├── races/             # carreras, streaming, ganador
│   │   │   ├── reservations/      # reservas de carril (+ lógica pura testeada)
│   │   │   ├── payments/          # confirmación de pago idempotente
│   │   │   ├── results/           # resultados/ganadores
│   │   │   ├── settings/          # ajustes editables en caliente
│   │   │   └── dashboard/         # agregado del panel
│   │   ├── routes/                # /api/public y /api/admin
│   │   └── scripts/               # admin:create y seed
│   └── client/                    # Frontend React (Vite)
│       ├── index.html             # fuentes de Google + favicon
│       └── src/
│           ├── components/        # Brand, CircuitBackground, LaneRow, CarCard, Modal, Neon
│           ├── pages/             # Home, Status, Stream, Admin (login + panel)
│           ├── hooks/usePolling   # polling con backoff y visibilidad
│           ├── services/api.ts    # cliente REST (con CSRF)
│           └── types/api.ts       # tipos de la API
├── database/
│   ├── migrations/0001_init.sql   # esquema completo (admins, events, cars, races,
│   │                              # reservations, payments, race_results, audit_logs, settings)
│   └── seeds/001_sample_cars.sql  # coches de arranque (idempotente)
├── public/branding/               # logos oficiales (banner-stream, logo-mascot, logo-vhs)
├── tests/                         # pruebas Vitest (lógica de carriles, hash, rate-limit)
├── dist/                          # build de producción (generado)
├── vite.config.ts / tsconfig*.json / tailwind.config.cjs / postcss.config.cjs
├── .env.example                   # plantilla de variables
└── package.json
```

## 3. Requisitos previos

- Node.js **20 o 22** y npm 10+.
- Una base de datos MySQL accesible (local para desarrollo; de Hostinger para producción).
- Cuenta de WhatsApp del negocio para recibir las solicitudes de pago.

## 4. Puesta en marcha local

```bash
# 1) Instalar dependencias
npm install

# 2) Configurar credenciales
cp .env.example .env      # editar DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, WHATSAPP_NUMBER...

# 3) Crear la base de datos y aplicar el esquema
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS carreras_hw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run migrate           # aplica database/migrations/*.sql (versionado, idempotente)
npm run seed              # (opcional) carga 6 coches de ejemplo

# 4) Crear el primer administrador
npm run admin:create -- --user admin --pass "ContraseñaSegura123"

# 5) Desarrollo (API :4000 + Vite :5173 con proxy /api)
npm run dev
# → Frontend: http://localhost:5173  |  API: http://localhost:4000/api/health

# 6) Producción local (compila server+client y sirve todo desde Express)
npm run build
npm start                 # respeta process.env.PORT (por defecto 4000)
```

Rutas del frontend: `/` (inscripción pública), `/status/:token` (estado de la reserva), `/stream` (pantalla en vivo), `/admin` (panel).

## 5. Variables de entorno

| Variable | Descripción | Defecto |
|---|---|---|
| `PORT` | Puerto de escucha. **En Hostinger lo inyecta el panel; no fijarlo.** | `4000` |
| `NODE_ENV` | `development` / `production` | `development` |
| `DB_HOST` / `DB_PORT` | Host/puerto MySQL (hPanel → Bases de datos) | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_PASSWORD` | Credenciales MySQL | — |
| `DB_NAME` | Nombre de la base de datos | `carreras_hw` |
| `DB_CONNECTION_LIMIT` | Conexiones concurrentes del pool (bajo = apto hosting compartido) | `5` |
| `SESSION_TTL_HOURS` | Vida de la sesión del administrador | `12` |
| `RESERVATION_EXPIRY_MINUTES` | Expiración de solicitudes sin pago (editable luego en el panel) | `30` |
| `WHATSAPP_NUMBER` | Número Click to Chat, formato internacional sin `+` | — |
| `ENTRY_PRICE` | Cuota de inscripción sugerida en el mensaje | `100` |
| `COOKIE_SECURE` | `true` si el sitio sirve por HTTPS | `auto (prod)` |
| `AUTO_MIGRATE` | Ejecuta migraciones pendientes al arrancar (para despliegues sin SSH) | `false` |
| `RATE_WINDOW_MS` / `RATE_LOGIN_MAX` / `RATE_RESERVATION_MAX` | Limitación de solicitudes (login e inscripciones) | `60000 / 8 / 20` |

Los valores de negocio (cuota, expiración, WhatsApp y las frecuencias de polling) se pueden **editar en caliente** desde el panel: pestaña *Ajustes & Historial*. El archivo `.env` solo necesita las credenciales de infraestructura.

## 6. Migraciones y semillas

- `npm run migrate` (dev) / `npm run migrate:prod` (compilado) — aplica archivos `.sql` pendientes en orden y los registra en `schema_migrations`. Nunca destruye datos.
- `AUTO_MIGRATE=true` ejecuta lo pendiente en cada arranque de la app: útil si el plan no permite SSH. Es una operación aditiva y segura; nunca reinicializa la base.
- `npm run seed` carga semillas idempotentes (`database/seeds/`). No borra ni sobreescribe datos existentes.

## 7. Reglas de negocio implementadas

- **6 carriles por carrera y 6 plazas confirmadas máximo.**
- La inscripción no requiere cuenta: nombre + contacto + carril + coche → estado `pending_payment`.
- El carril queda **apartado** mientras la solicitud esté activa (pendiente o confirmada); expira según configuración y se libera automáticamente.
- A nivel de base de datos, **columnas generadas + índices únicos** (`uq_res_lane`, `uq_res_car`) impiden que dos inscripciones activas ocupen el mismo carril o el mismo coche en una carrera, incluso bajo concurrencia extrema.
- La confirmación de pago es **transaccional e idempotente** (bloqueo `FOR UPDATE`, doble verificación de vigencia; un segundo clic no duplica el pago).
- Solicitudes **expiradas no pueden confirmarse** sin revalidación (botón *Reactivar*, que comprueba que carril y coche sigan libres).
- Al confirmarse el pago que completa la carrera (o al registrar un ganador), el sistema **habilita automáticamente la siguiente carrera** (`ensureNextRace`).
- Registro de **ganador** con validación de inscripción confirmada; corregible (*Quitar ganador*), y el resultado sobrevive a recargas del navegador.
- **Historial** de acciones críticas en `audit_logs` (login, pagos, carreras, ajustes...).

## 8. Panel administrativo (`/admin`)

| Pestaña | Funciones |
|---|---|
| **Resumen** | Métricas (pagos pendientes, confirmadas, carreras abiertas, coches), lista rápida para *Confirmar pago* / *Cancelar*, actividad reciente. |
| **Jornadas** | Crear jornada, marcar como *actual* (es la que se publica), cerrar/reactivar/archivar. |
| **Carreras** | Crear carrera (numeración automática), *Iniciar* / *Finalizar* / *Reabrir* / *Cancelar* (al cancelar se liberan los carriles), **Mostrar en /stream** (selección de carrera activa) y **Registrar ganador** (clic sobre un carril confirmado). |
| **Coches** | Alta/edición/baja de la flota (nombre, modelo, color, imagen), activar/desactivar. |
| **Inscripciones** | Tabla con filtros por estado; confirmar pago (método, monto, referencia, nota), extender plazo, reactivar expiradas, cancelar. |
| **Ajustes & Historial** | WhatsApp, cuota, expiración y frecuencias de polling; bitácora completa de acciones. |

El panel se refresca por polling (3–5 s configurable).

## 9. Pantalla de streaming (`/stream`) y OBS Studio

- Página **pública e independiente**, sin controles administrativos ni datos privados.
- Diseño panorámico **16:9** oscuro con la marca ALANBREX, seis carriles visuales con participante + coche, estado de la carrera, destacado especial del **ganador** (glow + trofeo) y pie con *próxima carrera* + último ganador.
- Se actualiza por **polling cada 2 s** (configurable). En segundo plano reduce la frecuencia (×4) y al recuperar el foco refresca inmediatamente. Ante errores de red reintenta con backoff y muestra el estado de conexión ("RECONECTANDO").

**Para OBS Studio:**
1. Añadir fuente → *Navegador*.
2. URL: `https://tu-dominio.com/stream`
3. Ancho 1920, Alto 1080 (16:9), FPS 30.
4. Marcar *Apagar fuente cuando no sea visible* opcional; el polling sigue vivo al reactivarse.

## 10. Despliegue en Hostinger

> Documentación oficial de referencia: hPanel → *Sitio web* → *Aplicaciones Node.js*. Confirmar que el plan soporte aplicaciones Node.js y MySQL.

1. **Crear la base de datos MySQL** desde hPanel (Bases de datos → MySQL). Anotar host (normalmente `localhost` o host remoto indicado), usuario, contraseña y nombre.
2. **Subir el proyecto** mediante Git (GitHub) o ZIP (Administrador de archivos).
3. **Crear la aplicación Node.js** en hPanel: elegir la versión de Node compatible (recomendado 20 o 22, coincide con `engines`), carpeta del proyecto y *archivo de aplicación*.
4. **Configurar variables de entorno** en la aplicación (equivalente al `.env`): `DB_*`, `WHATSAPP_NUMBER`, `ENTRY_PRICE`, `SESSION_TTL_HOURS`, `COOKIE_SECURE=true` (si hay SSL), `AUTO_MIGRATE=true` para el primer arranque. `PORT` no se define: lo inyecta el panel.
5. **Comando de compilación**: si el panel lo permite, `npm run build`. Si no, compilar localmente y subir `dist/` ya generado.
6. **Punto de entrada de producción**: comando de inicio `npm start` (equivalente a `node dist/server/server.js`). La app escucha en `process.env.PORT`.
7. **Ejecutar migraciones**: la primera vez con `AUTO_MIGRATE=true`, o vía consola/SSH disponible: `npm run migrate:prod`.
8. **Crear el primer administrador** (consola o SSH disponible): `npm run admin:create:prod -- --user admin --pass "ContraseñaSegura123"`.
9. Desplegar y verificar:
   - `https://tu-dominio.com/api/health` → `{"ok":true,"db":true}`
   - `/` carga la página de inscripción.
   - `/admin/login` permite entrar con el administrador creado.
   - `/stream` muestra la pantalla en vivo.
10. **Prueba de punta a punta**: crear jornada + coches + carrera, inscribirse desde `/`, confirmar el pago desde el panel y verificar que `/stream` refleja los cambios sin recargar.

**Actualizaciones sin perder datos:** las migraciones son aditivas y versionadas; subir nuevo código y arrancar no modifica datos. Nunca ejecutar procesos que reinicialicen la base. Hacer copia de seguridad de la BD desde hPanel antes de cada despliegue mayor.

## 11. API REST

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /api/health` | Público | Estado del servicio y de MySQL |
| `GET /api/public/event` | Público | Jornada actual + carreras abiertas + ajustes públicos |
| `GET /api/public/cars` | Público | Coches activos |
| `GET /api/public/races/:id` | Público | Detalle de carrera (sin datos de contacto) |
| `GET /api/public/stream` | Público | Payload de `/stream` (carrera activa, versión, pollMs) |
| `GET /api/public/races/:id/stream` | Público | Payload de streaming de una carrera concreta |
| `GET /api/public/results` | Público | Últimos ganadores |
| `POST /api/public/reservations` | Público (rate-limited) | Crear solicitud de inscripción → devuelve token + URL de WhatsApp |
| `GET /api/public/reservations/:token` | Público | Estado de la reserva por token |
| `POST /api/admin/auth/login` / `logout` | Público/privado | Sesión (cookie httpOnly) |
| `GET /api/admin/auth/me` | Sesión | Administrador actual + token CSRF |
| `GET /api/admin/dashboard` | Sesión | Agregado del panel |
| `GET/POST/PATCH /api/admin/events`, `POST /api/admin/events/:id/current` | Sesión+CSRF | Jornadas |
| `GET/POST/PATCH/DELETE /api/admin/cars` | Sesión+CSRF | Flota |
| `GET/POST /api/admin/races`, `PATCH /:id/status`, `POST /:id/active` | Sesión+CSRF | Carreras |
| `POST /api/admin/races/:id/winner`, `DELETE` | Sesión+CSRF | Registrar/quitar ganador |
| `GET /api/admin/reservations` | Sesión | Listado con filtros |
| `POST /api/admin/reservations/:id/confirm-payment` | Sesión+CSRF | Confirmar pago (idempotente) |
| `POST /api/admin/reservations/:id/reactivate` / `cancel` | Sesión+CSRF | Revalidar / cancelar |
| `GET/PUT /api/admin/settings` | Sesión+CSRF | Ajustes configurables |
| `GET /api/admin/audit` | Sesión | Historial de acciones |

Las mutaciones administrativas requieren la cabecera `X-CSRF-Token` (el cliente la obtiene de `login` / `me`).

## 12. Seguridad implementada

- Contraseñas con **scrypt** (`node:crypto`, sin dependencias nativas) y `timingSafeEqual`.
- Sesiones en base de datos: token aleatorio de 32 bytes, **almacenado hasheado (SHA-256)**, cookie `httpOnly` + `SameSite=Lax` + `Secure` configurable.
- **CSRF**: doble envío por cabecera en todas las mutaciones del panel.
- Validación de entradas con **zod** en todos los endpoints.
- **Consultas SQL parametrizadas** (sin concatenación).
- Cabeceras de seguridad con **helmet**; `x-powered-by` desactivado.
- **Rate limiting** por IP en login e inscripciones.
- Los endpoints públicos nunca devuelven contactos ni datos internos; errores sin fugas en producción.
- Secretos solo en variables de entorno; sin datos de tarjetas; el pago es **confirmado manualmente** por el organizador (el sistema no verifica pagos automáticamente).

## 13. Rendimiento en hosting compartido

- Un único proceso Node; pool MySQL pequeño (`DB_CONNECTION_LIMIT=5`).
- Sin temporizadores en el servidor: las expiraciones se resuelven **perezosamente** al consultar/confirmar (`expirePending`), sin cron ni workers.
- El polling lo realizan los navegadores (2 s stream / 3–5 s panel / 5 s disponibilidad), con backoff y menor frecuencia en segundo plano.
- Endpoints livianos por pantalla; detección de cambios por **versión** para evitar trabajo innecesario.
- Índices en las consultas frecuentes; `JSON` solo en bitácora; imágenes optimizadas por el admin.
- `/api/health` para monitoreo; cierre graceful de conexiones y captura de errores no controlados.

## 14. Checklist de validación en producción

- [ ] `/api/health` responde `db:true`.
- [ ] Migraciones aplicadas (`schema_migrations` contiene `0001_init.sql`).
- [ ] Administrador creado y login funcional en `/admin/login`.
- [ ] Jornada creada y marcada como actual; coches cargados; carrera abierta.
- [ ] Inscripción desde `/` llega a WhatsApp con el mensaje completo.
- [ ] No es posible reservar dos veces el mismo carril (prueba con dos pestañas).
- [ ] Máximo 6 confirmaciones por carrera; la siguiente carrera se habilita sola.
- [ ] Confirmar pago refleja el cambio en `/status/:token` y en `/stream` sin recargar.
- [ ] Ganador registrado se conserva tras recargar `/stream`.
- [ ] Endpoints admin devuelven 401/403 sin sesión o sin CSRF.
- [ ] Rate limiting activo en login e inscripciones.
- [ ] Copia de seguridad de la base de datos programada o manual desde hPanel.

## 15. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `/api/health` → `db:false` | Credenciales/host MySQL incorrectos | Revisar `DB_*`; en Hostinger usar el host indicado por hPanel |
| Error `ECONNRESET` al instalar | Red/proxy inestable | `npm install --fetch-retries=5` |
| La app no arranca en el panel | Versión de Node no soportada / entrada incorrecta | Seleccionar Node 20/22 y punto de entrada `dist/server/server.js` (`npm start`) |
| `/stream` queda en "RECONECTANDO" | API caída o redeploy en curso | Verificar `/api/health` y logs del panel |
| No llega el enlace de WhatsApp | `WHATSAPP_NUMBER` vacío (`.env` o Ajustes) | Configurarlo en la pestaña *Ajustes* |
| 403 CSRF en el panel | Token vencido en la pestaña | Recargar la página del panel |

## 16. Pruebas

```bash
npm test         # ejecuta las pruebas una vez
npm run test:watch
```

Cobertura actual: lógica pura de reservas (carriles, expiración, WhatsApp, transiciones de estado de carrera), hash/verificación de contraseñas y limitador de solicitudes.

---

### Supuestos de configuración documentados

- Se asume plan con **aplicaciones Node.js + MySQL** (los planes solo-estático no pueden ejecutar esta app).
- `PORT` y variables de entorno las gestiona el panel de Hostinger; `.env` se usa en desarrollo.
- La selección de versión de Node se hace en la creación de la aplicación Node.js del hPanel.
- Si el plan no permite SSH/consola, usar `AUTO_MIGRATE=true` y compilar localmente antes de subir.
