

export type ReservationStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
export type RaceStatus = 'pending' | 'open' | 'running' | 'finished' | 'cancelled';

export interface LaneOccupancy {
  lane: number;
  reservationId: number | null;
  reservationStatus: 'pending_payment' | 'confirmed' | null;
  participantName: string | null;
  contact: string | null;
  carId: number | null;
  carName: string | null;
  carImage: string | null;
  resUpdatedAt: string | null;
}

export interface RaceSummary {
  id: number;
  eventId: number;
  eventName?: string;
  raceNumber: number;
  status: RaceStatus;
  isActive: boolean;
  winnerLane: number | null;
  finishedAt: string | null;
  occupied: number;
  confirmed: number;
  freeLanes: number;
  lanes: LaneOccupancy[];
  updatedAt: string;
}

export interface PublicEvent {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export interface PublicEventData {
  event: PublicEvent | null;
  races: RaceSummary[];
  price: number;
  pollMs: number;
}

export interface StreamPayload {
  event: { id: number; name: string } | null;
  race: RaceSummary | null;
  nextRace: { id: number; raceNumber: number; freeLanes: number } | null;
  version: string;
  pollMs: number;
}

export interface PublicReservation {
  id: number;
  token: string;
  lane: number;
  status: ReservationStatus;
  participantName: string;
  carId: number;
  carName: string;
  carImage: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  race: { id: number; raceNumber: number; status: string };
  event: { id: number; name: string };
}

export interface ReservationCreated {
  reservation: PublicReservation;
  whatsappUrl: string | null;
}

export interface PublicCar {
  id: number;
  name: string;
  model: string | null;
  color: string | null;
  image_url: string | null;
}

export interface CarRow extends PublicCar {
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ResultRow {
  id: number;
  raceId: number;
  raceNumber: number;
  eventName: string;
  lane: number;
  carName: string;
  participantName: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface EventRow {
  id: number;
  name: string;
  description: string | null;
  status: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

export interface AdminReservationView {
  id: number;
  lane: number;
  status: ReservationStatus;
  participantName: string;
  contact: string;
  token: string;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  raceId: number;
  raceNumber: number;
  raceStatus: string;
  eventName: string;
  carName: string;
  isExpired: boolean;
}

export interface AuditRow {
  id: number;
  action: string;
  entity: string | null;
  entity_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
  admin_username: string | null;
}

export interface DashboardData {
  event: EventRow | null;
  races: RaceSummary[];
  pending: AdminReservationView[];
  pendingTotal: number;
  totals: {
    pendingActive: number;
    confirmedTotal: number;
    activeCars: number;
    openRaces: number;
  };
  settings: {
    whatsappNumber: string;
    entryPrice: number;
    reservationExpiryMinutes: number;
    streamPollMs: number;
    adminPollMs: number;
    availabilityPollMs: number;
  };
  audit: AuditRow[];
}

export interface AdminSettings {
  whatsappNumber: string;
  reservationExpiryMinutes: number;
  entryPrice: number;
  streamPollMs: number;
  adminPollMs: number;
  availabilityPollMs: number;
}

export interface AdminMe {
  admin: { id: number; username: string; displayName: string | null };
  csrfToken: string;
}
