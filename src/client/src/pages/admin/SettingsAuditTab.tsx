import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../services/api';
import { usePolling } from '../../hooks/usePolling';
import { fileToResizedDataUrl } from '../../services/image';
import type { AdminSettings } from '../../types/api';

const FIELDS: { key: keyof AdminSettings; apiKey: string; label: string; hint: string }[] = [
  { key: 'streamUrl', apiKey: 'stream_url', label: 'URL de Transmisión en Vivo', hint: 'Enlace de YouTube o Twitch (ej. https://www.youtube.com/watch?v=ID)' },
  { key: 'whatsappNumber', apiKey: 'whatsapp_number', label: 'WhatsApp del negocio', hint: 'Formato internacional sin + (ej. 5215512345678)' },
  { key: 'entryPrice', apiKey: 'entry_price', label: 'Cuota de inscripción', hint: 'Se muestra al público y se sugiere en el pago' },
  { key: 'reservationExpiryMinutes', apiKey: 'reservation_expiry_minutes', label: 'Expiración de solicitudes (min)', hint: 'Plazo para pagar antes de liberar el carril' },
  { key: 'streamPollMs', apiKey: 'stream_poll_ms', label: 'Polling /stream (ms)', hint: 'Frecuencia de actualización de la pantalla en vivo' },
  { key: 'adminPollMs', apiKey: 'admin_poll_ms', label: 'Polling panel (ms)', hint: 'Frecuencia de refresco del panel administrativo' },
  { key: 'availabilityPollMs', apiKey: 'availability_poll_ms', label: 'Polling disponibilidad (ms)', hint: 'Frecuencia en la página pública durante la selección' },
];


function detailsText(details: unknown): string {
  if (details === null || details === undefined) return '';
  if (typeof details === 'string') return details === 'null' ? '' : details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export default function SettingsAuditTab({ refresh }: { refresh: () => void }) {
  const settings = usePolling(api.getAdminSettings, 10000);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);

  const [audit, setAudit] = useState<{ rows: { id: number; action: string; admin_username: string | null; created_at: string; entity: string | null; entity_id: number | null; details: string | null; ip: string | null }[]; total: number } | null>(null);

  // Estado del widget "Código QR de pago".
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const currentQrUrl = settings.data?.paymentQrUrl || null;
  const previewSource = qrPreview ?? currentQrUrl;

  useEffect(() => {
    const data = settings.data;
    if (data && !loadedOnce) {
      const next: Record<string, string> = {};
      for (const field of FIELDS) next[field.key] = String(data[field.key]);
      setValues(next);
      setLoadedOnce(true);
    }
  }, [settings.data, loadedOnce]);

  async function loadAudit() {
    try {
      setAudit(await api.listAudit({ limit: 40 }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      for (const field of FIELDS) {
        const current = values[field.key] ?? '';
        const original = settings.data ? String(settings.data[field.key]) : '';
        if (current !== original) {
          await api.updateSetting(field.apiKey, current);
        }
      }
      setSaved(true);
      settings.refresh();
      refresh();
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  async function pickQr(file: File | null): Promise<void> {
    setQrMessage(null);
    if (!file) {
      setQrPreview(null);
      return;
    }
    try {
      setQrPreview(await fileToResizedDataUrl(file));
    } catch (err) {
      setQrMessage(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
    }
  }

  async function saveQr(): Promise<void> {
    if (!qrPreview) return;
    setQrBusy(true);
    setQrMessage(null);
    try {
      await api.uploadPaymentQr(qrPreview);
      setQrPreview(null);
      setQrMessage('✓ Código QR actualizado');
      settings.refresh();
      refresh();
    } catch (err) {
      setQrMessage(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setQrBusy(false);
    }
  }

  async function removeQr(): Promise<void> {
    setQrBusy(true);
    setQrMessage(null);
    try {
      await api.removePaymentQr();
      setQrPreview(null);
      setQrMessage('✓ Código QR eliminado');
      settings.refresh();
      refresh();
    } catch (err) {
      setQrMessage(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setQrBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="panel p-5">
        <h3 className="font-display font-bold italic text-lg text-silver mb-4">Ajustes</h3>
        <form onSubmit={handleSave} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block font-tech text-sm text-ash mb-1">{field.label}</label>
              <input
                className="input-dark font-mono"
                value={values[field.key] ?? ''}
                onChange={(e) => {
                  dirty.current = true;
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
              />
              <p className="mt-1 font-tech text-xs text-ash/60">{field.hint}</p>
            </div>
          ))}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
              {error}
            </div>
          )}
          <button type="submit" className="btn-neon text-sm" disabled={busy || !loadedOnce}>
            {busy ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        </form>
          {/*
        <div className="mt-6 border-t border-line pt-5">
          <h4 className="font-display font-bold italic text-sm text-silver mb-1">
            Código QR de pago
          </h4>
          <p className="font-tech text-xs text-ash/60 mb-3">
            Se muestra en la página de la reserva, junto al conteo regresivo. Si tu QR tiene fecha
            de vencimiento, sube uno nuevo cuando expire; los usuarios verán el cambio
            automáticamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="shrink-0">
              {previewSource ? (
                <img
                  src={previewSource}
                  alt={qrPreview ? 'QR nuevo (por guardar)' : 'Código QR de pago actual'}
                  className="h-32 w-32 rounded-lg border border-line bg-white p-1.5 object-contain"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-line px-2 text-center font-tech text-xs text-ash/50">
                  Sin QR configurado
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void pickQr(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer font-mono text-xs text-ash/80 hover:text-silver file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-neon/15 file:px-3 file:py-1.5 file:font-tech file:text-neon hover:file:bg-neon/25"
              />
              <p className="font-tech text-xs text-ash/60">
                Recomendado: PNG del QR limpio (sin recortes y con buen contraste).
              </p>
              <div className="flex gap-2">
                {qrPreview && (
                  <button type="button" className="btn-neon !px-3 !py-1.5 text-xs" disabled={qrBusy} onClick={() => void saveQr()}>
                    {qrBusy ? 'Guardando…' : 'Guardar QR'}
                  </button>
                )}
                {currentQrUrl && !qrPreview && (
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={qrBusy} onClick={() => void removeQr()}>
                    {qrBusy ? 'Quitando…' : 'Quitar QR'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {qrMessage && (
            <p
              className={`mt-2 font-tech text-xs ${
                qrMessage.startsWith('✓') ? 'text-neon' : 'text-red-300'
              }`}
            >
              {qrMessage}
            </p>
          )}
        </div> */}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold italic text-lg text-silver">Historial de acciones</h3>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={loadAudit}>
            Actualizar
          </button>
        </div>
        <div className="panel divide-y divide-line max-h-[520px] overflow-y-auto">
          {(audit?.rows ?? []).map((row) => (
            <div key={row.id} className="px-4 py-2.5 font-tech text-sm space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ash/60">
                  {new Date(row.created_at).toLocaleString('es-MX', { hour12: false })}
                </span>
                <span className="font-mono text-neon/90 text-xs uppercase">{row.action}</span>
              </div>
              <div className="text-xs text-ash">
                {row.admin_username ? `@${row.admin_username}` : 'sistema'}
                {row.entity ? ` · ${row.entity}#${row.entity_id ?? '—'}` : ''}
                {row.ip ? ` · ${row.ip}` : ''}
              </div>
              {detailsText(row.details) && (
                <div className="font-mono text-[11px] text-ash/50 truncate">{detailsText(row.details)}</div>
              )}
            </div>
          ))}
          {(audit?.rows ?? []).length === 0 && (
            <p className="px-4 py-6 text-center font-tech text-ash text-sm">Sin registros.</p>
          )}
        </div>
      </section>
    </div>
  );
}
