import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import CircuitBackground from '../components/CircuitBackground';
import LaneRow from '../components/LaneRow';
import { IconTrophy } from '../components/Neon';
import type { StreamPayload } from '../types/api';

export default function StreamPage() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const applyData = useCallback((prev: StreamPayload | null, next: StreamPayload): StreamPayload => {

    if (prev && prev.version === next.version) return prev;
    return next;
  }, []);

  const [pollMs, setPollMs] = useState(2000);
  const { data, connected, error } = usePolling(api.getStream, pollMs, { applyData });
  const results = usePolling(api.getResults, 15000);


  useEffect(() => {
    if (data?.pollMs && data.pollMs !== pollMs) setPollMs(data.pollMs);
  }, [data?.pollMs, pollMs]);

  const race = data?.race ?? null;
  const winner =
    race && race.winnerLane !== null
      ? race.lanes.find((l) => l.lane === race.winnerLane) ?? null
      : null;
  const lastResult = results.data?.results?.[0] ?? null;

  return (
    <div className="relative min-h-screen bg-void">
      <CircuitBackground fixed={false} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 px-6 py-5 xl:px-10">
        {/* Cabecera: jornada + LIVE + reloj */}
        <header className="flex items-center justify-between gap-6 border-b border-neon/25 pb-3">
          <div className="min-w-0">
            <div className="font-mono text-neon/70 text-xs tracking-[0.35em] uppercase">
              Alanbrex Stream
            </div>
            <div className="font-display font-black italic text-2xl md:text-4xl text-silver truncate">
              {data?.event?.name ?? 'CARRERAS HOT WHEELS'}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span
              className={`pill border ${
                connected && race
                  ? 'border-red-500/60 text-red-400 bg-red-500/10'
                  : 'border-ash/40 text-ash bg-ash/10'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connected && race ? 'bg-red-500 animate-pulse-live' : 'bg-ash'
                }`}
              />
              {connected ? (race ? 'EN VIVO' : 'EN ESPERA') : 'RECONECTANDO'}
            </span>
            <span className="hidden md:block font-mono text-2xl text-neon text-glow-soft">
              {new Date(now).toLocaleTimeString('es-MX', { hour12: false })}
            </span>
          </div>
        </header>

        {/* Cuerpo */}
        {!race ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-neon/60 tracking-[0.4em] text-sm uppercase">
                Esperando carrera
              </div>
              <p className="mt-3 font-tech text-ash text-xl">
                El organizador aún no ha seleccionado la carrera a transmitir.
              </p>
              {error && <p className="mt-2 font-tech text-sm text-red-400">{error}</p>}
            </div>
          </div>
        ) : (
          <>
            {/* Franja de carrera */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-neon/70 text-sm tracking-[0.3em] uppercase">
                  Carrera
                </span>
                <span className="font-display font-black italic text-5xl md:text-7xl text-silver skew-racing leading-none">
                  #{race.raceNumber}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {winner && race.winnerLane !== null && (
                  <span className="pill bg-neon text-void shadow-neon text-sm !px-4 !py-1.5">
                    <IconTrophy className="w-4 h-4" />
                    GANADOR: {winner.participantName} — {winner.carName}
                  </span>
                )}
                {!winner && (
                  <span className="font-mono text-ash text-sm">
                    CARRILES LIBRES: <span className="text-neon">{race.freeLanes}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Los seis carriles */}
            <div className="flex-1 flex flex-col justify-center gap-3">
              {race.lanes.map((laneData) => (
                <LaneRow
                  key={laneData.lane}
                  data={laneData}
                  variant="stream"
                  isWinnerLane={race.winnerLane === laneData.lane}
                />
              ))}
            </div>

            {/* Pie: próxima carrera + últimos resultados + marca */}
            <footer className="flex items-center justify-between gap-4 border-t border-neon/25 pt-3">
              <div className="font-tech text-ash text-sm md:text-base">
                {data?.nextRace ? (
                  <>
                    <span className="text-ash/70">PRÓXIMA: </span>
                    <span className="text-silver font-bold">CARRERA #{data.nextRace.raceNumber}</span>
                    <span className="text-ash/70"> · {data.nextRace.freeLanes} carriles libres</span>
                  </>
                ) : (
                  <span className="text-ash/70">Sin próximas carreras abiertas</span>
                )}
              </div>
              <div className="hidden md:block font-tech text-ash/70 text-sm truncate max-w-[420px]">
                {lastResult ? (
                  <>
                    <span className="text-neon">★ </span>
                    ÚLTIMO GANADOR: {lastResult.participantName} ({lastResult.carName})
                  </>
                ) : (
                  '—'
                )}
              </div>
              <img
                src="/branding/logo-mascot.jpg"
                alt="ALANBREX"
                className="w-14 h-14 rounded-lg object-cover border border-neon/40 shadow-neon-sm mix-blend-screen opacity-90"
                draggable={false}
              />
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
