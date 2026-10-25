import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import Brand from '../components/Brand';
import CircuitBackground from '../components/CircuitBackground';
import { IconTrophy, IconWhatsApp, StatusPill } from '../components/Neon';
import type { PublicReservation } from '../types/api';


export default function StatusPage() {
  const { token } = useParams<{ token: string }>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetcher = useCallback(
    (signal: AbortSignal) => api.getReservationByToken(token ?? '', signal),
    [token]
  );
  const { data, error, connected } = usePolling(fetcher, 5000, {
    enabled: Boolean(token),
  });

  const reservation: PublicReservation | null = data?.reservation ?? null;
  const whatsappUrl = data?.whatsappUrl ?? null;

  const remainingMs =
    reservation?.status === 'pending_payment' && reservation.expiresAt
      ? Math.max(0, new Date(reservation.expiresAt).getTime() - now)
      : null;
  const remainingLabel = remainingMs === null ? null : formatRemaining(remainingMs);

  return (
    <div className="relative min-h-screen">
      <CircuitBackground />
      <header className="relative z-10 border-b border-line bg-void/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Brand size="sm" />
          <Link to="/" className="btn-ghost !px-3 !py-1.5 text-xs">
            Volver a carreras
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        {error && !reservation && (
          <div className="panel p-8 text-center">
            <p className="font-display font-black italic text-xl text-red-400">
              {error === 'Inscripción no encontrada' ? 'Inscripción no encontrada' : 'Error de conexión'}
            </p>
            <p className="mt-2 font-tech text-ash text-sm">
              Revisa el enlace o vuelve a la página de carreras.
            </p>
          </div>
        )}

        {!error && !reservation && (
          <div className="panel p-8 text-center font-tech text-ash animate-pulse-live">
            Cargando estado de tu reserva…
          </div>
        )}

        {reservation && (
          <div className="space-y-6">
            {/* Estado principal */}
            <div
              className={`panel p-6 md:p-8 text-center ${
                reservation.status === 'confirmed' ? 'border-neon/50 shadow-neon' : ''
              }`}
            >
              {reservation.status === 'confirmed' && (
                <>
                  <IconTrophy className="w-12 h-12 mx-auto text-neon text-glow" />
                  <h1 className="mt-3 font-display font-black italic text-3xl md:text-4xl text-silver">
                    ¡Estás dentro!
                  </h1>
                  <p className="mt-2 font-tech text-ash">
                    Tu pago está confirmado. <span className="text-neon">Listo para correr.</span>
                  </p>
                </>
              )}
              {reservation.status === 'pending_payment' && (
                <>
                  <div className="pill bg-neon-acid/15 text-neon-acid border border-neon-acid/40 animate-pulse-live mx-auto w-fit">
                    Pago pendiente
                  </div>
                  <h1 className="mt-3 font-display font-black italic text-3xl md:text-4xl text-silver">
                    Reserva apartada
                  </h1>
                  <p className="mt-2 font-tech text-ash">
                    Envía tu comprobante por WhatsApp para que el administrador confirme tu pago.
                  </p>
                  {remainingLabel && (
                    <div className="mt-4 inline-flex flex-col items-center rounded-xl border border-neon/30 bg-void/60 px-6 py-3">
                      <span className="font-tech text-xs text-ash uppercase tracking-widest">
                        Tiempo restante
                      </span>
                      <span className="font-mono text-3xl text-neon text-glow">{remainingLabel}</span>
                    </div>
                  )}
                  {remainingMs === 0 && (
                    <p className="mt-3 font-tech text-sm text-yellow-500">
                      El plazo terminó; pide al administrador que revalide tu solicitud.
                    </p>
                  )}
                </>
              )}
              {reservation.status === 'expired' && (
                <>
                  <h1 className="font-display font-black italic text-3xl text-yellow-500">
                    Solicitud expirada
                  </h1>
                  <p className="mt-2 font-tech text-ash">
                    El plazo de pago terminó. Solicita al administrador revalidarla o inscríbete
                    de nuevo en un carril libre.
                  </p>
                </>
              )}
              {reservation.status === 'cancelled' && (
                <>
                  <h1 className="font-display font-black italic text-3xl text-red-400">
                    Solicitud cancelada
                  </h1>
                  <p className="mt-2 font-tech text-ash">
                    Esta reserva fue cancelada por el administrador.
                  </p>
                </>
              )}
            </div>

            {/* Detalles */}
            <div className="panel p-5 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Detail label="Jornada" value={reservation.event.name} />
                <Detail label="Carrera" value={`#${reservation.race.raceNumber}`} mono />
                <Detail label="Carril" value={String(reservation.lane)} mono />
                <Detail label="Coche" value={reservation.carName} />
                <Detail label="Participante" value={reservation.participantName} />
                <Detail label="Referencia" value={reservation.token.slice(0, 8).toUpperCase()} mono />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <StatusPill status={reservation.status} />
                <span className="font-tech text-xs text-ash/60">
                  {connected ? 'Actualización automática activa' : 'Reconectando…'}
                </span>
              </div>
            </div>

            {/* Acción WhatsApp */}
            {reservation.status === 'pending_payment' && (
              <div className="text-center">
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-neon !px-8 !py-3.5 text-lg">
                    <IconWhatsApp className="w-6 h-6" />
                    Enviar comprobante por WhatsApp
                  </a>
                ) : (
                  <p className="font-tech text-sm text-ash">
                    El número de WhatsApp aún no está configurado por el organizador.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-tech text-xs text-ash uppercase tracking-widest mb-1">{label}</div>
      <div className={`${mono ? 'font-mono text-lg text-neon' : 'font-display font-bold text-silver'} truncate`}>
        {value}
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
