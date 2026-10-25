import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, clearCsrf, setCsrf } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import Brand from '../components/Brand';
import CircuitBackground from '../components/CircuitBackground';
import { StatusPill } from '../components/Neon';
import OverviewTab from './admin/OverviewTab';
import EventsTab from './admin/EventsTab';
import RacesTab from './admin/RacesTab';
import CarsTab from './admin/CarsTab';
import ReservationsTab from './admin/ReservationsTab';
import SettingsAuditTab from './admin/SettingsAuditTab';
import type { DashboardData } from '../types/api';

type TabId = 'overview' | 'events' | 'races' | 'cars' | 'reservations' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'events', label: 'Jornadas' },
  { id: 'races', label: 'Carreras' },
  { id: 'cars', label: 'Coches' },
  { id: 'reservations', label: 'Inscripciones' },
  { id: 'settings', label: 'Ajustes & Historial' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setCsrf(me.csrfToken);
        setUsername(me.admin.displayName ?? me.admin.username);
      })
      .catch(() => {
        if (cancelled) return;
        clearCsrf();
        setAuthError(true);
        navigate('/admin/login', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const [pollMs, setPollMs] = useState(4000);
  const dashboard = usePolling(api.dashboard, pollMs, { enabled: !authError });
  const view = dashboard.data;
  const refresh = dashboard.refresh;

  
  useEffect(() => {
    if (view?.settings.adminPollMs && view.settings.adminPollMs !== pollMs) {
      setPollMs(view.settings.adminPollMs);
    }
  }, [view?.settings.adminPollMs, pollMs]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
  
    }
    clearCsrf();
    navigate('/admin/login');
  }

  if (authError) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <CircuitBackground />
        <p className="relative z-10 font-tech text-ash">Redirigiendo al login…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <CircuitBackground />

      <header className="relative z-10 border-b border-line bg-void/85 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <Brand size="sm" />
          <div className="flex items-center gap-3">
            <Link to="/stream" target="_blank" className="btn-ghost !px-3 !py-1.5 text-xs">
              Abrir /stream
            </Link>
            {username && (
              <span className="font-tech text-sm text-ash hidden sm:inline">
                <span className="text-neon">●</span> {username}
              </span>
            )}
            <button type="button" onClick={handleLogout} className="btn-ghost !px-3 !py-1.5 text-xs">
              Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-4 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg font-tech font-semibold uppercase tracking-wider text-xs whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'text-neon border-neon bg-neon/5'
                  : 'text-ash border-transparent hover:text-silver hover:border-line'
              }`}
            >
              {t.label}
              {t.id === 'reservations' && view && view.pendingTotal > 0 && (
                <span className="ml-2 pill bg-neon-acid/15 text-neon-acid border border-neon-acid/40">
                  {view.pendingTotal}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6">
        {!view ? (
          <div className="panel p-8 text-center font-tech text-ash animate-pulse-live">
            Cargando panel…
          </div>
        ) : (
          <>
            {view.event && (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="font-tech text-sm text-ash">Jornada actual:</span>
                <span className="font-display font-bold italic text-silver">{view.event.name}</span>
                <StatusPill status={view.event.status} />
                {Number(view.event.is_current) === 1 && <StatusPill status="current" />}
              </div>
            )}
            {tab === 'overview' && <OverviewTab data={view} refresh={refresh} />}
            {tab === 'events' && <EventsTab refresh={refresh} />}
            {tab === 'races' && <RacesTab data={view} refresh={refresh} />}
            {tab === 'cars' && <CarsTab refresh={refresh} />}
            {tab === 'reservations' && <ReservationsTab refresh={refresh} />}
            {tab === 'settings' && <SettingsAuditTab refresh={refresh} />}
          </>
        )}
      </main>
    </div>
  );
}
