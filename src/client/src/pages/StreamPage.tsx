import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import LaneRow from '../components/LaneRow';
import { IconTrophy } from '../components/Neon';
import type { StreamPayload } from '../types/api';

export default function StreamPage() {
  const [now, setNow] = useState(Date.now());

  // Reloj sincronizado mediante requestAnimationFrame para OBS
  useEffect(() => {
    let animationFrameId: number;

    const updateTime = () => {
      setNow(Date.now());
      animationFrameId = requestAnimationFrame(updateTime);
    };

    animationFrameId = requestAnimationFrame(updateTime);

    return () => cancelAnimationFrame(animationFrameId);
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

  return (
    // Fondo Fucsia (#FF00FF) para Chroma Key limpio en OBS
    <div className="relative min-h-screen bg-[#FF00FF] overflow-hidden select-none flex justify-end">
      
      {/* Contenedor principal posicionado a la derecha en formato columna (Ancho fijo de ~520px) */}
      <div className="relative z-10 w-full max-w-[520px] flex flex-col h-screen justify-between p-4 gap-3 bg-black/40 backdrop-blur-[2px]">
        
        {/* Cabecera compacta: Evento, Estado y Reloj */}
        <header className="flex flex-col gap-2 bg-black border-2 border-neon p-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="font-mono text-neon text-[10px] tracking-[0.3em] uppercase font-black">
              Alanbrex Racing Live
            </div>
            
            {/* Etiqueta EN VIVO 100% Sólida y Opaca */}
            <div className={`px-3 py-1 rounded-lg flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-zinc-950 border-2 shadow-2xl ${
              isLive ? 'text-red-500 border-red-600' : 'text-neon border-neon'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-neon'}`} />
              <span className="text-white">
                {connected ? (race ? 'EN VIVO' : 'EN ESPERA') : 'RECONECTANDO'}
              </span>
            </div>

          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-display font-black italic text-xl text-white truncate">
              {data?.event?.name ?? 'CARRERAS HOT WHEELS'}
            </div>
            <span className="font-mono text-xl text-neon font-black bg-zinc-900 px-3 py-1 rounded-lg border border-neon/50">
              {new Date(now).toLocaleTimeString('es-MX', { hour12: false })}
            </span>
          </div>
        </header>

        {/* Cuerpo principal */}
        {!race ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center bg-black p-8 rounded-2xl border-2 border-neon shadow-2xl">
              <div className="font-mono text-neon tracking-[0.3em] text-xs uppercase font-black animate-pulse">
                Sistemas en Espera
              </div>
              <p className="mt-3 font-tech text-white text-lg font-bold">
                El organizador aún no ha seleccionado la carrera.
              </p>
              {error && <p className="mt-2 font-tech text-xs text-red-400 font-bold">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 justify-center">
            
            {/* Tarjeta de Número de Carrera y Ganador */}
            <div className="bg-black px-5 py-3 rounded-2xl border-2 border-zinc-700 shadow-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-neon text-[10px] tracking-[0.3em] uppercase font-black block">
                  Grilla Oficial
                </span>
                <span className="font-display font-black italic text-4xl text-white skew-racing leading-none">
                  #{race.raceNumber}
                </span>
              </div>
              <div>
                {winner && race.winnerLane !== null && (
                  <span className="bg-neon text-black text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg">
                    <IconTrophy className="w-4 h-4 text-black" />
                    GANADOR: C-{winner.lane}
                  </span>
                )}
                {!winner && (
                  <span className="font-mono text-white text-xs font-bold bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-700">
                    LIBRES: <span className="text-neon font-black">{race.freeLanes}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Listado vertical de los 6 carriles */}
            <div className="flex flex-col gap-2 bg-black/95 p-3.5 rounded-2xl border-2 border-neon/50 shadow-2xl">
              {race.lanes.map((laneData) => (
                <div 
                  key={laneData.lane} 
                  className={`px-3 py-2 rounded-xl border transition-all ${
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

        {/* Pie de página vertical compacto */}
        <footer className="flex flex-col gap-2 bg-black px-4 py-3 rounded-2xl border-t-4 border-neon shadow-2xl">
          <div className="font-tech text-white font-bold text-xs flex justify-between items-center">
            {data?.nextRace ? (
              <>
                <span><strong className="text-neon">PRÓXIMA:</strong> #{data.nextRace.raceNumber}</span>
                <span className="text-zinc-400">({data.nextRace.freeLanes} libres)</span>
              </>
            ) : (
              <span className="text-zinc-500">Sin próximas carreras</span>
            )}
          </div>
          
          <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
            <div className="font-tech text-zinc-300 font-semibold text-xs truncate max-w-[340px]">
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
                className="w-9 h-9 rounded-lg object-cover border border-neon"
                draggable={false}
              />
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}