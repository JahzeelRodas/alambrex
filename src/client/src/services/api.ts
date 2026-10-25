import type {
  AdminMe,
  AdminReservationView,
  AdminSettings,
  AuditRow,
  CarRow,
  DashboardData,
  EventRow,
  PublicCar,
  PublicEventData,
  ReservationCreated,
  RaceSummary,
  ResultRow,
  StreamPayload,
} from '../types/api';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const CSRF_KEY = 'hw_csrf';

export function getCsrf(): string {
  return sessionStorage.getItem(CSRF_KEY) ?? '';
}

export function setCsrf(token: string): void {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
}

export function clearCsrf(): void {
  sessionStorage.removeItem(CSRF_KEY);
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && getCsrf()) headers['X-CSRF-Token'] = getCsrf();

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });

  if (!res.ok) {
    let code = 'ERROR';
    let message = `Error ${res.status}`;
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } };
      code = json?.error?.code ?? code;
      message = json?.error?.message ?? message;
    } catch {

    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export const api = {

  getPublicEvent: (signal?: AbortSignal) =>
    request<PublicEventData>('/public/event', { signal }),
  getRace: (id: number, signal?: AbortSignal) =>
    request<{ race: RaceSummary }>(`/public/races/${id}`, { signal }),
  getStream: (signal?: AbortSignal) => request<StreamPayload>('/public/stream', { signal }),
  getRaceStream: (id: number, signal?: AbortSignal) =>
    request<StreamPayload>(`/public/races/${id}/stream`, { signal }),
  getResults: (signal?: AbortSignal) =>
    request<{ results: ResultRow[] }>('/public/results', { signal }),
  getPublicCars: (signal?: AbortSignal) =>
    request<{ cars: PublicCar[] }>('/public/cars', { signal }),
  createReservation: (body: {
    raceId: number;
    lane: number;
    carId: number;
    participantName: string;
    contact: string;
  }) => request<ReservationCreated>('/public/reservations', { method: 'POST', body }),
  getReservationByToken: (token: string, signal?: AbortSignal) =>
    request<ReservationCreated>(`/public/reservations/${token}`, { signal }),


  login: (username: string, password: string) =>
    request<AdminMe>('/admin/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request<{ ok: boolean }>('/admin/auth/logout', { method: 'POST' }),
  me: (signal?: AbortSignal) => request<AdminMe>('/admin/auth/me', { signal }),


  dashboard: (signal?: AbortSignal) => request<DashboardData>('/admin/dashboard', { signal }),
  listEvents: (signal?: AbortSignal) =>
    request<{ events: EventRow[] }>('/admin/events', { signal }),
  createEvent: (name: string, description: string | null) =>
    request<{ event: EventRow }>('/admin/events', { method: 'POST', body: { name, description } }),
  updateEvent: (
    id: number,
    patch: { name?: string; description?: string | null; status?: string }
  ) => request<{ event: EventRow }>(`/admin/events/${id}`, { method: 'PATCH', body: patch }),
  setCurrentEvent: (id: number) =>
    request<{ ok: boolean }>(`/admin/events/${id}/current`, { method: 'POST' }),
  listAdminRaces: (eventId?: number, signal?: AbortSignal) =>
    request<{ races: RaceSummary[] }>(
      `/admin/races${eventId ? `?eventId=${eventId}` : ''}`,
      { signal }
    ),
  createRace: (eventId: number, raceNumber?: number, isActive?: boolean) =>
    request<{ race: RaceSummary }>('/admin/races', {
      method: 'POST',
      body: { eventId, raceNumber, isActive },
    }),
  setRaceStatus: (id: number, status: string) =>
    request<{ race: RaceSummary }>(`/admin/races/${id}/status`, { method: 'PATCH', body: { status } }),
  setActiveRace: (id: number) =>
    request<{ ok: boolean }>(`/admin/races/${id}/active`, { method: 'POST' }),
  setWinner: (raceId: number, lane: number) =>
    request<{ race: RaceSummary }>(`/admin/races/${raceId}/winner`, {
      method: 'POST',
      body: { lane },
    }),
  clearWinner: (raceId: number) =>
    request<{ race: RaceSummary }>(`/admin/races/${raceId}/winner`, { method: 'DELETE' }),

  listCars: (signal?: AbortSignal) => request<{ cars: CarRow[] }>('/admin/cars', { signal }),
  uploadCarImage: (dataUrl: string) =>
    request<{ url: string }>('/admin/cars/image', { method: 'POST', body: { dataUrl } }),
  createCar: (body: { name: string; model?: string | null; color?: string | null; image_url?: string | null }) =>
    request<{ car: CarRow }>('/admin/cars', { method: 'POST', body }),
  updateCar: (id: number, patch: { name?: string; model?: string | null; color?: string | null; image_url?: string | null; is_active?: boolean }) =>
    request<{ car: CarRow }>(`/admin/cars/${id}`, { method: 'PATCH', body: patch }),
  deleteCar: (id: number) =>
    request<{ deleted: boolean; deactivated: boolean }>(`/admin/cars/${id}`, { method: 'DELETE' }),

  listReservations: (
    params: { status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return request<{ rows: AdminReservationView[]; total: number }>(
      `/admin/reservations${query ? `?${query}` : ''}`,
      { signal }
    );
  },
  confirmPayment: (
    id: number,
    body: { method: string; amount?: number | null; reference?: string | null; note?: string | null }
  ) => request<{ reservationId: number; alreadyConfirmed: boolean }>(
    `/admin/reservations/${id}/confirm-payment`,
    { method: 'POST', body }
  ),
  reactivateReservation: (id: number) =>
    request<{ ok: boolean }>(`/admin/reservations/${id}/reactivate`, { method: 'POST' }),
  cancelReservation: (id: number) =>
    request<{ ok: boolean }>(`/admin/reservations/${id}/cancel`, { method: 'POST' }),

  getAdminSettings: (signal?: AbortSignal) => request<AdminSettings>('/admin/settings', { signal }),
  updateSetting: (key: string, value: string) =>
    request<AdminSettings>('/admin/settings', { method: 'PUT', body: { key, value } }),
  listAudit: (params: { limit?: number; offset?: number; action?: string } = {}, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.action) qs.set('action', params.action);
    const query = qs.toString();
    return request<{ rows: AuditRow[]; total: number }>(
      `/admin/audit${query ? `?${query}` : ''}`,
      { signal }
    );
  },
};
