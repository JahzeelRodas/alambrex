import { useState } from 'react';
import { api, ApiError } from '../../services/api';
import { fileToResizedDataUrl } from '../../services/image';
import { usePolling } from '../../hooks/usePolling';
import Modal from '../../components/Modal';
import { StatusPill } from '../../components/Neon';
import type { CarRow } from '../../types/api';

interface EditState {
  id: number;
  name: string;
  model: string;
  color: string;
  image_url: string;
}


function useCarImage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);

  async function pickImage(file: File | null): Promise<void> {
    if (!file) {
      setImagePreview(null);
      setImageData(null);
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setImageData(dataUrl);
      setImagePreview(dataUrl);
    } catch (err) {
      throw err instanceof Error ? err : new Error('No se pudo leer la imagen');
    }
  }

  function resetImage(): void {
    setImagePreview(null);
    setImageData(null);
  }

  return { imagePreview, imageData, pickImage, resetImage, setPreview: setImagePreview };
}

export default function CarsTab({ refresh }: { refresh: () => void }) {
  const cars = usePolling(api.listCars, 8000);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);

  const newImage = useCarImage();
  const editImage = useCarImage();

  
  async function resolveImageUrl(data: string | null, fallbackUrl: string): Promise<string | null> {
    if (data) {
      const { url } = await api.uploadCarImage(data);
      return url;
    }
    return fallbackUrl || null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const image = await resolveImageUrl(newImage.imageData, imageUrl);
      await api.createCar({
        name,
        model: model || null,
        color: color || null,
        image_url: image,
      });
      setName('');
      setModel('');
      setColor('');
      setImageUrl('');
      newImage.resetImage();
      cars.refresh();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      cars.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="panel p-5">
        <h3 className="font-display font-bold italic text-lg text-silver mb-4">Añadir coche</h3>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 flex items-center gap-3">
            {newImage.imagePreview ? (
              <img
                src={newImage.imagePreview}
                alt="Vista previa"
                className="w-24 h-16 rounded-lg border border-line object-cover"
              />
            ) : (
              <div className="w-24 h-16 rounded-lg border border-dashed border-line dot-grid flex items-center justify-center font-mono text-2xl text-neon/25">
                HW
              </div>
            )}
            <p className="font-tech text-xs text-ash/70 leading-snug">
              Foto del autito (opcional).<br />
              JPG/PNG/WEBP — se optimiza al subir.
            </p>
          </div>
          <label className="md:col-span-2 input-dark flex !items-center !justify-center cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                newImage
                  .pickImage(file)
                  .catch((err: Error) => setError(err.message));
              }}
            />
            <span className="font-tech text-sm text-ash">📷 Elegir imagen…</span>
          </label>

          <input
            className="input-dark md:col-span-2"
            placeholder="Nombre (ej. Twin Mill)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
          <input className="input-dark" placeholder="Modelo / serie (opcional)" value={model} onChange={(e) => setModel(e.target.value)} />
          <input className="input-dark" placeholder="Color (opcional)" value={color} onChange={(e) => setColor(e.target.value)} />
          <input
            className="input-dark md:col-span-4"
            placeholder="URL de imagen (opcional, alternativa al archivo)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          {error && (
            <div className="md:col-span-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-tech text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="md:col-span-4">
            <button type="submit" className="btn-neon text-sm" disabled={busy || name.length < 2}>
              Añadir a la flota
            </button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="font-display font-bold italic text-lg text-silver mb-3">
          Flota <span className="font-mono text-sm text-ash">({cars.data?.cars.length ?? 0})</span>
        </h3>
        <div className="panel divide-y divide-line">
          {(cars.data?.cars ?? []).map((car: CarRow) => (
            <div key={car.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="w-12 h-9 rounded-md border border-line bg-void/60 overflow-hidden flex items-center justify-center shrink-0">
                {car.image_url ? (
                  <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="font-mono text-neon/25 text-xs font-bold italic">HW</span>
                )}
              </div>
              <span className={`font-display font-bold italic flex-1 min-w-[140px] ${Number(car.is_active) ? 'text-silver' : 'text-ash/50 line-through'}`}>
                {car.name}
              </span>
              <span className="font-tech text-sm text-ash hidden md:block truncate max-w-[160px]">
                {car.model ?? '—'}
              </span>
              {car.color && (
                <span className="font-tech text-[10px] uppercase tracking-wider text-neon/80 border border-neon/30 rounded px-1.5 py-0.5">
                  {car.color}
                </span>
              )}
              <StatusPill status={Number(car.is_active) ? 'active' : 'archived'} label={Number(car.is_active) ? 'Activo' : 'Inactivo'} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                  onClick={() => {
                    editImage.resetImage();
                    setEdit({
                      id: car.id,
                      name: car.name,
                      model: car.model ?? '',
                      color: car.color ?? '',
                      image_url: car.image_url ?? '',
                    });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => withBusy(() => api.updateCar(car.id, { is_active: !Number(car.is_active) }))}
                >
                  {Number(car.is_active) ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs text-red-400"
                  disabled={busy}
                  onClick={() => withBusy(() => api.deleteCar(car.id))}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {(cars.data?.cars ?? []).length === 0 && (
            <p className="px-4 py-6 text-center font-tech text-ash text-sm">
              No hay coches registrados. Añade al menos seis para la primera carrera.
            </p>
          )}
        </div>
      </section>

      <Modal open={edit !== null} title={`Editar coche`} onClose={() => setEdit(null)}>
        {edit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void withBusy(async () => {
                const image = await resolveImageUrl(editImage.imageData, edit.image_url);
                await api.updateCar(edit.id, {
                  name: edit.name,
                  model: edit.model || null,
                  color: edit.color || null,
                  image_url: image,
                });
              }).then(() => {
                setEdit(null);
                refresh();
              });
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-20 h-14 rounded-lg border border-line bg-void/60 overflow-hidden flex items-center justify-center shrink-0">
                {editImage.imagePreview || edit.image_url ? (
                  <img
                    src={editImage.imagePreview ?? edit.image_url ?? ''}
                    alt={edit.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-neon/25 text-lg font-bold italic">HW</span>
                )}
              </div>
              <label className="input-dark flex-1 flex !items-center !justify-center cursor-pointer !py-2 !px-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    editImage.pickImage(file).catch((err: Error) => {
                      setError(err.message);
                      e.target.value = '';
                    });
                  }}
                />
                <span className="font-tech text-sm text-ash">📷 Cambiar imagen…</span>
              </label>
            </div>
            <input className="input-dark" placeholder="Nombre" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} />
            <input className="input-dark" placeholder="Modelo / serie" value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} />
            <input className="input-dark" placeholder="Color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            <input className="input-dark" placeholder="URL de imagen" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} />
            <button type="submit" className="btn-neon w-full text-sm" disabled={busy}>
              Guardar cambios
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
