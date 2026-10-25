import type { LaneOccupancy } from '../types/api';
import { IconTrophy } from './Neon';

type Variant = 'home' | 'stream' | 'admin';

interface LaneRowProps {
  data: LaneOccupancy;
  variant?: Variant;
  isWinnerLane?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const LANE_STATE = {
  free: {
    label: 'LIBRE',
    box: 'border-dashed border-ash/40 text-ash/80',
    row: 'border-line bg-panel/40',
  },
  pending: {
    label: 'PAGO PEND.',
    box: 'border-neon-acid/60 text-neon-acid bg-neon-acid/10',
    row: 'border-neon-acid/30 bg-neon-acid/[0.04]',
  },
  confirmed: {
    label: 'CONFIRMADO',
    box: 'border-neon/70 text-neon bg-neon/10',
    row: 'border-neon/35 bg-neon/[0.05]',
  },
} as const;


export default function LaneRow({ data, variant = 'home', isWinnerLane = false, selected = false, onClick }: LaneRowProps) {
  const isFree = data.reservationId === null;
  const state = isFree
    ? LANE_STATE.free
    : data.reservationStatus === 'confirmed'
      ? LANE_STATE.confirmed
      : LANE_STATE.pending;

  const clickable = Boolean(onClick) && isFree;
  const height = variant === 'stream' ? 'min-h-[64px] py-3' : 'min-h-[52px] py-2';

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 rounded-lg border transition-all duration-150 ${height} ${state.row}
        ${clickable ? 'cursor-pointer hover:border-neon/70 hover:bg-neon/[0.08] hover:shadow-neon-sm' : 'cursor-default'}
        ${selected ? 'ring-1 ring-neon shadow-neon' : ''}
        ${isWinnerLane ? 'border-neon shadow-neon bg-neon/[0.10] animate-pulse-glow' : ''}`}
    >
      {/* Número de carril */}
      <span
        className={`shrink-0 flex items-center justify-center rounded-md font-mono border ${
          variant === 'stream' ? 'w-12 h-10 text-2xl' : 'w-9 h-8 text-lg'
        } ${isFree ? 'border-line text-ash/70' : 'border-neon/60 text-neon'}`}
      >
        {data.lane}
      </span>

      {/* Coche + participante */}
      <span className="flex-1 min-w-0">
        <span
          className={`block font-display font-bold italic truncate ${
            variant === 'stream' ? 'text-lg' : 'text-sm'
          } ${isFree ? 'text-ash/60' : 'text-silver'}`}
        >
          {data.carName ?? '—'}
        </span>
        <span
          className={`block font-tech truncate ${
            variant === 'stream' ? 'text-base' : 'text-xs'
          } ${isFree ? 'text-ash/50' : 'text-ash'}`}
        >
          {isFree ? 'Carril disponible' : (data.participantName ?? '—')}
        </span>
      </span>

      {/* Estado / ganador */}
      <span className="shrink-0 flex items-center gap-2">
        {isWinnerLane && (
          <span className="pill bg-neon text-void shadow-neon">
            <IconTrophy className="w-3.5 h-3.5" />
            GANADOR
          </span>
        )}
        {!isWinnerLane && (
          <span
            className={`pill border ${state.box} ${
              data.reservationStatus === 'pending_payment' ? 'animate-pulse-live' : ''
            }`}
          >
            {state.label}
          </span>
        )}
      </span>
    </button>
  );
}
