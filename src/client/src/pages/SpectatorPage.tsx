import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import LaneRow from '../components/LaneRow';
import { IconTrophy } from '../components/Neon';
import type { StreamPayload } from '../types/api';

function getEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1`;
  }
  return rawUrl;
}

export default function SpectatorPage() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
  const isLive = connected && race;
  const streamUrl = data?.event?.streamUrl;

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white select-none flex flex-col xl:flex-row p-3 gap-3 box-border overflow-x-hidden">
      
      {/* SECCIÓN IZQUIERDA: Reproductor de Video en Vivo dinámico */}
      <div className="w-full xl:flex-1 flex flex-col justify-center items-center my-auto">
        <div className="w-full max-w-6xl aspect-video bg-black rounded-2xl border-2 border-neon/40 shadow-2xl overflow-hidden flex flex-col items-center justify-center relative">
          
          {streamUrl ? (
            <iframe
              className="w-full h-full border-0"
              src={getEmbedUrl(streamUrl) ?? ''}
              title="Transmisión en Vivo Hot Wheels"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="text-center p-6">
              <div className="font-display font-black italic text-3xl text-neon mb-2">
                TRANSMISIÓN EN VIVO
              </div>
              <p className="font-tech text-zinc-400 text-sm">
                Espacio para el reproductor de video de la competencia Hot Wheels.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* SECCIÓN DERECHA: Panel lateral */}
      <div className="w-full xl:w-[480px] flex flex-col h-auto xl:h-[calc(100vh-1.5rem)] justify-between gap-2 bg-zinc-900/60 backdrop-blur-md p-3 rounded-2xl border border-zinc-800">
        
        {/* Cabecera */}
        <header className="flex flex-col gap-1.5 bg-black border-2 border-neon p-3 rounded-xl shadow-xl shrink-0">
          <div className="flex items-center justify-between">
            <div className="font-mono text-neon text-[9px] tracking-[0.3em] uppercase font-black">
              Alanbrex Racing Spectator
            </div>
            <div className={`px-2.5 py-0.5 rounded-md flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-zinc-950 border ${
              isLive ? 'text-red-500 border-red-600' : 'text-neon border-neon'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-neon'}`} />
              <span className="text-white">
                {connected ? (race ? 'EN VIVO' : 'EN ESPERA') : 'RECONECTANDO'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-display font-black italic text-lg text-white truncate">
              {data?.event?.name ?? 'CARRERAS HOT WHEELS'}
            </div>
            <span className="font-mono text-base text-neon font-black bg-zinc-900 px-2.5 py-0.5 rounded-md border border-neon/50">
              {new Date(now).toLocaleTimeString('es-MX', { hour12: false })}
            </span>
          </div>
        </header>

        {/* Cuerpo principal */}
        {!race ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="text-center bg-black p-6 rounded-xl border-2 border-neon shadow-xl w-full">
              <div className="font-mono text-neon tracking-[0.3em] text-xs uppercase font-black animate-pulse">
                Sistemas en Espera
              </div>
              <p className="mt-2 font-tech text-white text-base font-bold">
                El organizador aún no ha seleccionado la carrera.
              </p>
              {error && <p className="mt-1 font-tech text-xs text-red-400 font-bold">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2 justify-between overflow-hidden">
            
            {/* Grilla Oficial */}
            <div className="bg-black px-4 py-2.5 rounded-xl border-2 border-zinc-700 shadow-lg flex items-center justify-between shrink-0">
              <div>
                <span className="font-mono text-neon text-[9px] tracking-[0.3em] uppercase font-black block">
                  Grilla Oficial
                </span>
                <span className="font-display font-black italic text-3xl text-white skew-racing leading-none">
                  #{race.raceNumber}
                </span>
              </div>
              <div>
                {winner && race.winnerLane !== null && (
                  <span className="bg-neon text-black text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md">
                    <IconTrophy className="w-3.5 h-3.5 text-black" />
                    GANADOR: C-{winner.lane}
                  </span>
                )}
                {!winner && (
                  <span className="font-mono text-white text-xs font-bold bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-700">
                    LIBRES: <span className="text-neon font-black">{race.freeLanes}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Listado de los 6 carriles */}
            <div className="flex flex-col gap-1.5 bg-black/95 p-2.5 rounded-xl border-2 border-neon/50 shadow-xl overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
              {race.lanes.map((laneData) => (
                <div 
                  key={laneData.lane} 
                  className={`px-2.5 py-1.5 rounded-lg border transition-all shrink-0 ${
                    race.winnerLane === laneData.lane 
                      ? 'bg-neon/20 border-neon shadow-neon-sm' 
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <LaneRow
                    data={laneData}
                    variant="stream"
                    isWinnerLane={race.winnerLane === laneData.lane}
                  />
                </div>
              ))}
            </div>

          </div>
        )}

        <footer className="flex flex-col gap-1.5 bg-black px-3 py-2.5 rounded-xl border-t-2 border-neon shadow-xl shrink-0">
          <div className="font-tech text-white font-bold text-[11px] flex justify-between items-center">
            {data?.nextRace ? (
              <>
                <span><strong className="text-neon">PRÓXIMA:</strong> #{data.nextRace.raceNumber}</span>
                <span className="text-zinc-400">({data.nextRace.freeLanes} libres)</span>
              </>
            ) : (
              <span className="text-zinc-500">Sin próximas carreras</span>
            )}
          </div>
          
          <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5">
            <div className="font-tech text-zinc-300 font-semibold text-[11px] truncate max-w-[320px]">
              {lastResult ? (
                <>
                  <span className="text-neon font-black">★ </span>
                  {lastResult.participantName} ({lastResult.carName})
                </>
              ) : (
                <span className="text-zinc-500">Sin resultados previos</span>
              )}
            </div>
            <a 
              href="https://www.rovelbots.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src="/branding/logo-mascot.jpg"
                alt="ROVELBOTS"
                className="w-7 h-7 rounded-md object-cover border border-neon"
                draggable={false}
              />
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}