import { useState } from 'react';
import { api, ApiError } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import { StatusPill } from '../../components/Neon';
import type { EventRow } from '../../types/api';


export default function EventsTab({ refresh }: { refresh: () => void }) {
  const eventsPoll = usePolling(api.listEvents, 8000);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const events = eventsPoll.data?.events ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createEvent(name, description || null);
      setName('');
      setDescription('');
      eventsPoll.refresh();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      eventsPoll.refresh();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="panel p-5">
        <h3 className="font-display font-bold italic text-lg text-silver mb-4">Nueva jornada</h3>
        <form onSubmit={handleCreate} className="space-y-3 max-w-xl">
          <input
            className="input-dark"
            placeholder="Nombre de la jornada (ej. Gran Prix Alanbrex #1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={140}
          />
          <textarea
            className="input-dark"
            placeholder="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
          />
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
              {error}
            </div>
          )}
          <button type="submit" className="btn-neon" disabled={busy || name.length < 3}>
            Crear jornada
          </button>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold italic text-lg text-silver">
            Jornadas <span className="font-mono text-sm text-ash">({events.length})</span>
          </h3>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => eventsPoll.refresh()}>
            Actualizar
          </button>
        </div>
        {events.length === 0 ? (
          <div className="panel p-6 text-center font-tech text-ash text-sm">
            No hay jornadas todavía. Crea la primera arriba.
          </div>
        ) : (
          <div className="panel divide-y divide-line">
            {events.map((ev: EventRow) => (
              <div key={ev.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-display font-bold italic text-silver">{ev.name}</div>
                  {ev.description && (
                    <div className="font-tech text-xs text-ash truncate">{ev.description}</div>
                  )}
                </div>
                <StatusPill status={ev.status} />
                {Number(ev.is_current) === 1 && <StatusPill status="current" />}
                <div className="flex gap-2">
                  {Number(ev.is_current) !== 1 && ev.status !== 'archived' && (
                    <button
                      type="button"
                      className="btn-neon !px-3 !py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => action(() => api.setCurrentEvent(ev.id))}
                    >
                      Hacer actual
                    </button>
                  )}
                  {ev.status !== 'closed' && ev.status !== 'archived' && (
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => action(() => api.updateEvent(ev.id, { status: 'closed' }))}
                    >
                      Cerrar
                    </button>
                  )}
                  {ev.status === 'closed' && (
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => action(() => api.updateEvent(ev.id, { status: 'active' }))}
                    >
                      Reactivar
                    </button>
                  )}
                  {ev.status !== 'archived' && Number(ev.is_current) !== 1 && (
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => action(() => api.updateEvent(ev.id, { status: 'archived' }))}
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 font-tech text-xs text-ash/70">
          La jornada marcada como «actual» es la que ve el público y la que rueda en /stream.
        </p>
      </section>
    </div>
  );
}
