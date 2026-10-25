import { useState } from 'react';
import { api, ApiError } from '../../services/api';
import LaneRow from '../../components/LaneRow';
import { IconPlus, StatusPill } from '../../components/Neon';
import type { TabProps } from './tabTypes';
import type { RaceSummary } from '../../types/api';


export default function RacesTab({ data, refresh }: TabProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [winnerMode, setWinnerMode] = useState<number | null>(null);

  const event = data.event;
  const races = data.races;

  async function run(raceId: number, fn: () => Promise<unknown>) {
    setBusyId(raceId);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusyId(null);
    }
  }

  async function createRace() {
    if (!event) return;
    setBusyId(-1);
    setError(null);
    try {
      await api.createRace(event.id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusyId(null);
    }
  }

  if (!event) {
    return (
      <div className="panel p-6 text-center font-tech text-ash">
        Primero crea y marca como actual una jornada en la pestaña "Jornadas".
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold italic text-lg text-silver">
          Carreras de <span className="text-neon">{event.name}</span>
        </h3>
        <button type="button" className="btn-neon !py-2 text-sm" disabled={busyId !== null} onClick={createRace}>
          <IconPlus className="w-4 h-4" />
          Nueva carrera
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
          {error}
        </div>
      )}

      {races.length === 0 ? (
        <div className="panel p-6 text-center font-tech text-ash">
          Sin carreras todavía. Crea la primera.
        </div>
      ) : (
        races.map((race: RaceSummary) => (
          <article
            key={race.id}
            className={`panel p-4 ${race.isActive ? 'border-neon/50' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <span className="font-display font-black italic text-2xl text-silver skew-racing">
                  #{race.raceNumber}
                </span>
                <StatusPill status={race.status} />
                {race.isActive && (
                  <span className="pill bg-neon text-void shadow-neon-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-void animate-pulse-live" />
                    EN VIVO
                  </span>
                )}
                {race.winnerLane !== null && (
                  <span className="font-mono text-xs text-neon">Ganador: carril {race.winnerLane}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!race.isActive && ['open', 'running', 'finished'].includes(race.status) && (
                  <button
                    type="button"
                    className="btn-outline !px-3 !py-1.5 text-xs"
                    disabled={busyId === race.id}
                    onClick={() => run(race.id, () => api.setActiveRace(race.id))}
                  >
                    Mostrar en /stream
                  </button>
                )}
                {race.status === 'open' && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    disabled={busyId === race.id}
                    onClick={() => run(race.id, () => api.setRaceStatus(race.id, 'running'))}
                  >
                    Iniciar
                  </button>
                )}
                {race.status === 'running' && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    disabled={busyId === race.id}
                    onClick={() => run(race.id, () => api.setRaceStatus(race.id, 'finished'))}
                  >
                    Finalizar
                  </button>
                )}
                {race.status === 'finished' && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    disabled={busyId === race.id}
                    onClick={() => run(race.id, () => api.setRaceStatus(race.id, 'open'))}
                  >
                    Reabrir
                  </button>
                )}
                {['open', 'running', 'pending'].includes(race.status) && (
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs text-red-400"
                    disabled={busyId === race.id}
                    onClick={() => run(race.id, () => api.setRaceStatus(race.id, 'cancelled'))}
                  >
                    Cancelar carrera
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {race.lanes.map((laneData) => {
                const inWinnerMode = winnerMode === race.id;
                const isConfirmed = !laneData.reservationStatus || laneData.reservationStatus.toLowerCase() === 'confirmed';
                const canSelect = inWinnerMode && isConfirmed;

                return (
                  <div key={laneData.lane} className="relative">
                    <LaneRow
                      data={laneData}
                      variant="admin"
                      isWinnerLane={race.winnerLane === laneData.lane}
                    />
                    {canSelect && (
                      <div
                        onClick={() => {
                          run(race.id, () => api.setWinner(race.id, laneData.lane)).then(() => setWinnerMode(null));
                        }}
                        className="absolute inset-0 cursor-pointer bg-neon/10 hover:bg-neon/20 rounded-lg border-2 border-neon transition-all z-10 flex items-center justify-end pr-4"
                      >
                        <span className="font-tech text-xs text-neon font-bold bg-void/90 px-3 py-1.5 rounded border border-neon shadow-neon-sm">
                          MARCAR GANADOR
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {winnerMode === race.id ? (
                <>
                  <span className="pill bg-neon/15 text-neon border border-neon/40">
                    Haz clic en un carril para registrar el ganador
                  </span>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => setWinnerMode(null)}
                  >
                    Cancelar selección
                  </button>
                </>
              ) : (
                <>
                  {['running', 'finished'].includes(race.status) && (
                    <button
                      type="button"
                      className="btn-outline !px-3 !py-1.5 text-xs"
                      disabled={busyId === race.id}
                      onClick={() => setWinnerMode(race.id)}
                    >
                      Registrar ganador
                    </button>
                  )}
                  {race.winnerLane !== null && (
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      disabled={busyId === race.id}
                      onClick={() => run(race.id, () => api.clearWinner(race.id))}
                    >
                      Quitar ganador
                    </button>
                  )}
                </>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}