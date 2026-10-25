import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import Brand from '../components/Brand';
import CircuitBackground from '../components/CircuitBackground';
import LaneRow from '../components/LaneRow';
import CarCard from '../components/CarCard';
import { IconFlag, IconWhatsApp, SectionTitle, StatusPill } from '../components/Neon';
import type { RaceSummary } from '../types/api';

interface Selection {
  raceId: number;
  raceNumber: number;
}

function raceStatusMeta(
  status: string,
  eventStatus: string | undefined
): { selectable: boolean; cta: string } {

  if (eventStatus !== 'active') {
    return { selectable: false, cta: 'Jornada cerrada' };
  }
  if (status === 'open') return { selectable: true, cta: 'Elegir carril' };
  if (status === 'running') return { selectable: false, cta: 'En marcha' };
  return { selectable: false, cta: 'Ver' };
}

export default function HomePage() {
  const navigate = useNavigate();

  const [pollMs, setPollMs] = useState(5000);
  const eventData = usePolling(api.getPublicEvent, pollMs);
  const carsData = usePolling(api.getPublicCars, 30000);
  const resultsData = usePolling(api.getResults, 30000);

  const { data, refresh } = eventData;


  useEffect(() => {
    if (data?.pollMs && data.pollMs !== pollMs) setPollMs(data.pollMs);
  }, [data?.pollMs, pollMs]);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [carId, setCarId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedRace = selection
    ? (data?.races ?? []).find((r) => r.id === selection.raceId) ?? null
    : null;

  const takenCarIds = useMemo(() => {
    const ids = new Set<number>();
    for (const laneData of selectedRace?.lanes ?? []) {
      if (laneData.carId !== null) ids.add(Number(laneData.carId));
    }
    return ids;
  }, [selectedRace]);


  useEffect(() => {
    if (carId !== null && takenCarIds.has(carId)) {
      setCarId(null);
      setFormError('Ese coche ya está reservado en esta carrera; elige otro disponible');
    }
  }, [takenCarIds, carId]);

  const openReservation = useCallback(
    (race: RaceSummary, pickedLane: number) => {
      setSelection({ raceId: race.id, raceNumber: race.raceNumber });
      setLane(pickedLane);
      setCarId(null);
      setFormError(null);
      window.setTimeout(() => {
        document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection || lane === null || carId === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await api.createReservation({
        raceId: selection.raceId,
        lane,
        carId,
        participantName: name,
        contact,
      });
      navigate(`/status/${created.reservation.token}`);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'No se pudo conectar con el servidor'
      );
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <CircuitBackground />

      {/* Barra superior */}
      <header className="relative z-10 border-b border-line bg-void/80 backdrop-blur sticky top-0">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Brand size="sm" />
          <nav className="flex items-center gap-2">
            <a href="#carreras" className="btn-ghost !px-3 !py-1.5 text-xs">
              Carreras
            </a>
            <Link to="/stream" className="btn-ghost !px-3 !py-1.5 text-xs">
              En vivo
            </Link>
            <Link to="/admin" className="btn-ghost !px-3 !py-1.5 text-xs">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20">
        {/* Hero con el banner oficial ALANBREX */}
        <section className="relative mt-6 overflow-hidden rounded-2xl border border-line">
          <img
            src="/branding/banner-stream.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/20" />
          <div className="relative px-6 py-14 md:px-12 md:py-24 max-w-2xl">
            <div className="font-mono text-neon text-xs tracking-[0.4em] uppercase mb-3">
              Seis carriles · Un ganador
            </div>
            <h1 className="font-display font-black italic text-4xl md:text-6xl leading-[0.95] text-silver">
              CARRERAS <span className="text-neon text-glow">HOT&nbsp;WHEELS</span>
            </h1>
            <p className="mt-4 text-ash font-tech text-lg max-w-lg">
              Reserva tu carril, elige tu coche y confirma tu pago por WhatsApp.
              ¡La próxima carrera te espera!
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#carreras" className="btn-neon">
                Inscríbete ahora
              </a>
              <Link to="/stream" className="btn-outline">
                Ver en vivo
              </Link>
            </div>
          </div>
        </section>

        {/* Jornada actual */}
        <section className="mt-12">
          <SectionTitle kicker="Jornada actual">La competición</SectionTitle>
          {!data?.event ? (
            <div className="panel p-8 text-center">
              <IconFlag className="w-10 h-10 mx-auto text-neon/50" />
              <p className="mt-3 font-tech text-lg text-ash">
                Aún no hay jornada activa. Vuelve pronto para conocer el calendario.
              </p>
            </div>
          ) : (
            <div className="panel p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display font-black italic text-2xl text-silver">
                    {data.event.name}
                  </div>
                  {data.event.description && (
                    <p className="mt-1 font-tech text-ash">{data.event.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={data.event.status} />
                  {data.price > 0 && (
                    <span className="pill border border-neon/40 text-neon">Cuota ${data.price}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Carreras */}
        <section id="carreras" className="mt-12 scroll-mt-20">
          <SectionTitle kicker="Carriles disponibles">Elige tu carrera</SectionTitle>
          {(data?.races ?? []).length === 0 ? (
            <div className="panel p-8 text-center font-tech text-ash">
              No hay carreras abiertas en este momento.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(data?.races ?? []).map((race) => {
                const meta = raceStatusMeta(race.status, data?.event?.status);
                return (
                  <article
                    key={race.id}
                    className={`panel p-4 flex flex-col gap-3 ${
                      selection?.raceId === race.id ? 'ring-1 ring-neon shadow-neon-sm' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-black italic text-2xl text-silver skew-racing">
                          #{race.raceNumber}
                        </span>
                        <StatusPill status={race.status} />
                      </div>
                      <span className="font-mono text-xs text-ash">
                        {race.freeLanes}/6 libres
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {race.lanes.map((laneData) => (
                        <LaneRow
                          key={laneData.lane}
                          data={laneData}
                          variant="home"
                          isWinnerLane={race.winnerLane === laneData.lane}
                          onClick={
                            meta.selectable && laneData.reservationId === null
                              ? () => openReservation(race, laneData.lane)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                    {meta.selectable && race.freeLanes > 0 && (
                      <button
                        type="button"
                        className="btn-outline !py-2 text-sm"
                        onClick={() => openReservation(race, race.lanes.find((l) => l.reservationId === null)?.lane ?? 1)}
                      >
                        {meta.cta}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Flujo de reserva */}
        {selection && (
          <section id="reserva" className="mt-12 scroll-mt-20">
            <SectionTitle kicker={`Carrera #${selection.raceNumber}`}>
              Reserva tu carril
            </SectionTitle>
            <div className="panel p-5 md:p-6 space-y-8">
              {/* Paso 1: carril */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-neon text-lg">01</span>
                  <h3 className="font-display font-bold italic text-lg text-silver">Elige tu carril</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(selectedRace?.lanes ?? []).map((laneData) => (
                    <LaneRow
                      key={laneData.lane}
                      data={laneData}
                      variant="admin"
                      selected={lane === laneData.lane}
                      onClick={
                        laneData.reservationId === null ? () => setLane(laneData.lane) : undefined
                      }
                    />
                  ))}
                  {!selectedRace && (
                    <p className="font-tech text-ash text-sm col-span-2">
                      Cargando carriles…
                    </p>
                  )}
                </div>
              </div>

              {/* Paso 2: coche */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-neon text-lg">02</span>
                  <h3 className="font-display font-bold italic text-lg text-silver">Elige tu coche</h3>
                </div>
                {(carsData.data?.cars ?? []).length === 0 ? (
                  <p className="font-tech text-ash text-sm">No hay coches disponibles.</p>
                ) : (
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    {(carsData.data?.cars ?? []).map((car) => {
                      const taken = takenCarIds.has(car.id);
                      return (
                        <CarCard
                          key={car.id}
                          car={car}
                          selected={carId === car.id}
                          disabled={taken}
                          onClick={taken ? undefined : () => setCarId(car.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Paso 3: datos */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-neon text-lg">03</span>
                  <h3 className="font-display font-bold italic text-lg text-silver">Tus datos</h3>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                  <div>
                    <label htmlFor="name" className="block font-tech text-sm text-ash mb-1">
                      Nombre del participante
                    </label>
                    <input
                      id="name"
                      className="input-dark"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact" className="block font-tech text-sm text-ash mb-1">
                      WhatsApp de contacto
                    </label>
                    <input
                      id="contact"
                      className="input-dark"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Ej. 55 1234 5678"
                      required
                      minLength={5}
                      maxLength={160}
                    />
                  </div>

                  <div className="rounded-lg border border-neon/30 bg-neon/[0.06] px-4 py-3 font-tech text-sm">
                    <span className="text-ash">Resumen: </span>
                    <span className="text-silver">
                      Carrera #{selection.raceNumber} · Carril {lane ?? '—'} ·{' '}
                      {carsData.data?.cars.find((c) => c.id === carId)?.name ?? 'coche sin elegir'}
                    </span>
                    {Boolean(data?.price && data.price > 0) && (
                      <span className="text-neon"> · Cuota ${data?.price}</span>
                    )}
                  </div>

                  {formError && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-tech text-sm text-red-300">
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-neon"
                    disabled={submitting || lane === null || carId === null || name.length < 2 || contact.length < 5}
                  >
                    <IconWhatsApp />
                    {submitting ? 'Reservando…' : 'Reservar y continuar'}
                  </button>
                  <p className="font-tech text-xs text-ash/80">
                    Se abrirá WhatsApp con tu solicitud lista para enviar. El pago se confirma
                    manualmente; tu carril queda apartado durante el tiempo establecido.
                  </p>
                </form>
              </div>
            </div>
          </section>
        )}

        {/* Resultados recientes */}
        <section className="mt-12">
          <SectionTitle kicker="Historial">Últimos ganadores</SectionTitle>
          {(resultsData.data?.results ?? []).length === 0 ? (
            <div className="panel p-6 text-center font-tech text-ash">
              Todavía no se ha registrado ningún ganador.
            </div>
          ) : (
            <div className="panel divide-y divide-line">
              {(resultsData.data?.results ?? []).map((result) => (
                <div
                  key={result.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-panel2/50 transition-colors"
                >
                  <span className="font-mono text-neon w-16">#{result.raceNumber}</span>
                  <span className="font-display font-bold italic text-silver flex-1 truncate">
                    {result.participantName}
                  </span>
                  <span className="hidden sm:block font-tech text-ash text-sm truncate max-w-[180px]">
                    {result.carName}
                  </span>
                  <span className="font-tech text-xs text-ash/70 whitespace-nowrap">
                    {result.eventName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-line bg-void/80">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap items-center justify-between gap-4">
          <Brand size="sm" />
          <div className="font-tech text-xs text-ash/70">
            Seis carriles · Un ganador · Powered by ALANBREX STREAM
          </div>
        </div>
      </footer>
    </div>
  );
}
