import { ApiError } from '../../middleware/errors';
import { LANES_PER_RACE } from '../../config/env';


const TRANSITIONS: Record<string, string[]> = {
  pending: ['open', 'cancelled'],
  open: ['running', 'finished', 'cancelled', 'pending'],
  running: ['finished', 'open', 'cancelled'],
  finished: ['open'],
  cancelled: ['open'],
};

export function assertRaceTransition(current: string, next: string): void {
  if (current === next) return;
  const allowed = TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new ApiError(409, 'INVALID_TRANSITION', `No se puede pasar de "${current}" a "${next}"`);
  }
}

export function isValidLane(lane: number): boolean {
  return Number.isInteger(lane) && lane >= 1 && lane <= LANES_PER_RACE;
}


export function computeExpiresAt(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}


export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export interface ReservationMessageInput {
  eventName: string;
  raceNumber: number;
  lane: number;
  carName: string;
  participantName: string;
  token: string;
  price?: number | null;
}

export function buildReservationMessage(input: ReservationMessageInput): string {
  const lines = [
    'Hola, quiero confirmar mi inscripción a la carrera Hot Wheels:',
    `*Jornada:* ${input.eventName}`,
    `*Carrera:* #${input.raceNumber}`,
    `*Carril:* ${input.lane}`,
    `*Coche:* ${input.carName}`,
    `*Nombre:* ${input.participantName}`,
    `*Referencia:* ${input.token}`,
  ];
  if (input.price !== null && input.price !== undefined && input.price > 0) {
    lines.push(`*Cuota:* $${input.price}`);
  }
  lines.push('Quedo pendiente de la confirmación de pago. ¡Gracias!');
  return lines.join('\n');
}
