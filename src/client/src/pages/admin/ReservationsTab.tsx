import { useState, useEffect } from 'react';
import { api, ApiError } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import Modal from '../../components/Modal';
import { StatusPill } from '../../components/Neon';
import type { AdminReservationView } from '../../types/api';

const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Todas' },
  { id: 'pending_payment', label: 'Pendiente de pago' },
  { id: 'confirmed', label: 'Confirmadas' },
  { id: 'expired', label: 'Expiradas' },
  { id: 'cancelled', label: 'Canceladas' },
];

interface ConfirmState {
  reservation: AdminReservationView;
}

export default function ReservationsTab({ refresh }: { refresh: () => void }) {
  const [filter, setFilter] = useState('pending_payment');
  

  const list = usePolling(
    (signal) => api.listReservations({ status: filter || undefined, limit: 100 }, signal),
    5000,
    { enabled: true }
  );


  useEffect(() => {
    list.refresh();
  }, [filter]);

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<ConfirmState | null>(null);
  const [method, setMethod] = useState('transfer');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  async function run(id: number, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      list.refresh();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!confirming) return;
    await run(confirming.reservation.id, () =>
      api.confirmPayment(confirming.reservation.id, {
        method,
        amount: amount !== '' ? Number(amount) : null,
        reference: reference || null,
        note: note || null,
      })
    );
    setConfirming(null);
    setAmount('');
    setReference('');
    setNote('');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg font-tech font-semibold uppercase tracking-wider text-xs border transition-colors ${
              filter === f.id
                ? 'text-neon border-neon/60 bg-neon/10'
                : 'text-ash border-line hover:border-neon/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="border-b border-line font-tech text-xs text-ash uppercase tracking-wider">
              <th className="px-4 py-3">Creada</th>
              <th className="px-4 py-3">Jornada</th>
              <th className="px-4 py-3">Carrera</th>
              <th className="px-4 py-3">Carril</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Coche</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="font-tech text-sm">
            {(list.data?.rows ?? []).map((res) => (
              <tr key={res.id} className="border-b border-line/60 hover:bg-panel2/40">
                <td className="px-4 py-2.5 font-mono text-xs text-ash/70 whitespace-nowrap">
                  {new Date(res.createdAt).toLocaleString('es-MX', { hour12: false })}
                </td>
                <td className="px-4 py-2.5 text-ash max-w-[160px] truncate">{res.eventName}</td>
                <td className="px-4 py-2.5 font-mono text-neon">#{res.raceNumber}</td>
                <td className="px-4 py-2.5 font-mono text-neon">{res.lane}</td>
                <td className="px-4 py-2.5 text-silver">{res.participantName}</td>
                <td className="px-4 py-2.5 text-ash">{res.carName}</td>
                <td className="px-4 py-2.5 text-ash">{res.contact}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={res.status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {res.status === 'pending_payment' && (
                      <button
                        type="button"
                        className="btn-neon !px-3 !py-1.5 text-xs"
                        disabled={busyId === res.id}
                        onClick={() => setConfirming({ reservation: res })}
                      >
                        Confirmar pago
                      </button>
                    )}
                    {res.status === 'pending_payment' && (
                      <button
                        type="button"
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        disabled={busyId === res.id}
                        onClick={() => run(res.id, () => api.reactivateReservation(res.id))}
                        title="Extender el plazo de pago"
                      >
                        Extender
                      </button>
                    )}
                    {(res.status === 'expired' || res.status === 'cancelled') && (
                      <button
                        type="button"
                        className="btn-outline !px-3 !py-1.5 text-xs"
                        disabled={busyId === res.id}
                        onClick={() => run(res.id, () => api.reactivateReservation(res.id))}
                      >
                        Reactivar
                      </button>
                    )}
                    {(res.status === 'pending_payment' || res.status === 'confirmed') && (
                      <button
                        type="button"
                        className="btn-ghost !px-3 !py-1.5 text-xs text-red-400"
                        disabled={busyId === res.id}
                        onClick={() => run(res.id, () => api.cancelReservation(res.id))}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(list.data?.rows ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-ash">
                  No hay inscripciones con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirming !== null}
        title={`Confirmar pago — ${confirming?.reservation.participantName ?? ''}`}
        onClose={() => setConfirming(null)}
      >
        {confirming && (
          <form onSubmit={handleConfirm} className="space-y-3">
            <div className="font-tech text-sm text-ash">
              Carrera #{confirming.reservation.raceNumber} · Carril {confirming.reservation.lane} ·{' '}
              {confirming.reservation.carName}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-tech text-xs text-ash mb-1">Método</label>
                <select className="input-dark" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Efectivo</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block font-tech text-xs text-ash mb-1">Monto (opcional)</label>
                <input className="input-dark" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block font-tech text-xs text-ash mb-1">Referencia (opcional)</label>
              <input className="input-dark" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <label className="block font-tech text-xs text-ash mb-1">Nota (opcional)</label>
              <input className="input-dark" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="submit" className="btn-neon w-full" disabled={busyId !== null}>
              Confirmar pago
            </button>
            <p className="font-tech text-xs text-ash/70">
              La confirmación es idempotente: si la reserva ya estaba confirmada, no se duplica el
              registro de pago.
            </p>
          </form>
        )}
      </Modal>
    </div>
  );
}