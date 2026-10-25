import { queryOne } from '../../database/pool';
import * as events from '../events/service';
import * as races from '../races/service';
import * as reservations from '../reservations/service';
import * as audit from '../audit/service';
import { getSettings } from '../settings/service';

export interface DashboardData {
  event: events.EventRow | null;
  races: races.RaceSummary[];
  pending: reservations.AdminReservationView[];
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
  audit: audit.AuditRow[];
}


export async function getDashboard(): Promise<DashboardData> {
  const [event, settings] = await Promise.all([events.getCurrentEvent(), getSettings()]);
  const [racesList, pendingList, totalsRow, auditRows] = await Promise.all([
    event ? races.listRaces(event.id, { includeContact: true }) : Promise.resolve([]),
    reservations.listAdmin({ status: 'pending_payment', limit: 15, offset: 0 }),
    queryOne<{ pending_active: number; confirmed_total: number; active_cars: number }>(
      `SELECT
         (SELECT COUNT(*) FROM reservations WHERE status = 'pending_payment' AND expires_at > NOW()) AS pending_active,
         (SELECT COUNT(*) FROM reservations WHERE status = 'confirmed') AS confirmed_total,
         (SELECT COUNT(*) FROM cars WHERE is_active = 1) AS active_cars`
    ),
    audit.listAudit({ limit: 8, offset: 0 }),
  ]);

  return {
    event,
    races: racesList,
    pending: pendingList.rows,
    pendingTotal: pendingList.total,
    totals: {
      pendingActive: Number(totalsRow?.pending_active ?? 0),
      confirmedTotal: Number(totalsRow?.confirmed_total ?? 0),
      activeCars: Number(totalsRow?.active_cars ?? 0),
      openRaces: racesList.filter((r) => r.status === 'open').length,
    },
    settings: {
      whatsappNumber: settings.whatsappNumber,
      entryPrice: settings.entryPrice,
      reservationExpiryMinutes: settings.reservationExpiryMinutes,
      streamPollMs: settings.streamPollMs,
      adminPollMs: settings.adminPollMs,
      availabilityPollMs: settings.availabilityPollMs,
    },
    audit: auditRows.rows as audit.AuditRow[],
  };
}
