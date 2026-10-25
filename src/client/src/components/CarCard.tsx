import type { PublicCar } from '../types/api';

interface CarCardProps {
  car: PublicCar;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** Tarjeta de coche para la selección del participante. */
export default function CarCard({ car, selected = false, disabled = false, onClick }: CarCardProps) {
  const selectable = Boolean(onClick) && !disabled;

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onClick}
      className={`group relative w-full text-left rounded-xl border bg-panel overflow-hidden transition-all duration-150
        ${selected ? 'border-neon shadow-neon' : 'border-line hover:border-neon/60 hover:shadow-neon-sm'}
        ${selectable ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}
        ${disabled ? 'grayscale opacity-55' : ''}`}
    >
      <div className="aspect-[16/10] bg-void/60 flex items-center justify-center overflow-hidden border-b border-line">
        {car.image_url ? (
          <img
            src={car.image_url}
            alt={car.name}
            className="w-full h-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="relative w-full h-full dot-grid flex items-center justify-center">
            <span className="font-display font-black italic text-5xl text-neon/25 group-hover:text-neon/50 transition-colors">
              HW
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="font-display font-bold italic text-silver truncate">{car.name}</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-tech text-xs text-ash truncate">{car.model ?? 'Hot Wheels'}</span>
          {car.color && (
            <span className="font-tech text-[10px] uppercase tracking-wider text-neon/80 border border-neon/30 rounded px-1.5 py-0.5">
              {car.color}
            </span>
          )}
        </div>
      </div>
      {selected && (
        <span className="absolute top-2 right-2 pill bg-neon text-void shadow-neon">Elegido</span>
      )}
      {!selected && disabled && (
        <span className="absolute top-2 right-2 pill bg-ash/20 text-ash border border-ash/40">
          Reservado
        </span>
      )}
    </button>
  );
}
