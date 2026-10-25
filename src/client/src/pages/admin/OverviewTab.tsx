import { useState } from 'react';
import { api, ApiError } from '../../services/api';
import LaneRow from '../../components/LaneRow';
import { IconWhatsApp, StatusPill } from '../../components/Neon';
import type { TabProps } from './tabTypes';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <div className="font-tech text-xs text-ash uppercase tracking-widest">{label}</div>
      <div className="mt-1 font-mono text-3xl text-neon text-glow-soft">{value}</div>
    </div>
  );
}

export default function OverviewTab({ data, refresh }: TabProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function confirmPayment(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.confirmPayment(id, { method: 'transfer' });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.cancelReservation(id);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pagos pendientes" value={data.totals.pendingActive} />
        <StatCard label="Inscripciones confirmadas" value={data.totals.confirmedTotal} />
        <StatCard label="Carreras abiertas" value={data.totals.openRaces} />
        <StatCard label="Coches activos" value={data.totals.activeCars} />
      </div>

      <section>
        <h3 className="font-display font-bold italic text-lg text-silver mb-3">
          Pagos por confirmar{' '}
          <span className="font-mono text-sm text-neon-acid">({data.pendingTotal})</span>
        </h3>
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
            {error}
          </div>
        )}
        {data.pending.length === 0 ? (
          <div className="panel p-6 text-center font-tech text-ash">
            No hay pagos pendientes de confirmar.
          </div>
        ) : (
          <div className="panel divide-y divide-line">
            {data.pending.map((res) => (
              <div key={res.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-mono text-neon w-14">#{res.raceNumber}</span>
                <span className="font-mono text-ash w-10">C{res.lane}</span>
                <span className="font-display font-bold italic text-silver flex-1 min-w-[140px] truncate">
                  {res.participantName}
                </span>
                <span className="font-tech text-sm text-ash hidden md:block truncate max-w-[140px]">
                  {res.carName}
                </span>
                <span className="font-tech text-sm text-ash hidden lg:block">{res.contact}</span>
                {res.isExpired ? (
                  <StatusPill status="expired" />
                ) : (
                  <StatusPill status="pending_payment" />
                )}
                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/${res.contact.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost !px-2 !py-1.5"
                    title="Contactar por WhatsApp"
                  >
                    <IconWhatsApp className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    className="btn-neon !px-3 !py-1.5 text-xs"
                    disabled={busyId === res.id}
                    onClick={() => confirmPayment(res.id)}
                  >
                    Confirmar pago
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    disabled={busyId === res.id}
                    onClick={() => cancel(res.id)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display font-bold italic text-lg text-silver mb-3">Actividad reciente</h3>
        <div className="panel divide-y divide-line">
          {data.audit.length === 0 ? (
            <p className="px-4 py-4 font-tech text-ash text-sm">Sin actividad registrada.</p>
          ) : (
            data.audit.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-2 font-tech text-sm">
                <span className="font-mono text-xs text-ash/60 w-36">
                  {new Date(row.created_at).toLocaleString('es-MX', { hour12: false })}
                </span>
                <span className="font-mono text-neon/90 text-xs uppercase">{row.action}</span>
                <span className="text-ash truncate">
                  {row.admin_username ? `@${row.admin_username}` : 'sistema'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
