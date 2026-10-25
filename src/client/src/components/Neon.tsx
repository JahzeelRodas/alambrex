import type { ReactNode } from 'react';



const PILL_STYLES: Record<string, string> = {
  open: 'bg-neon/15 text-neon border border-neon/40',
  running: 'bg-neon-bright/15 text-neon-bright border border-neon-bright/50',
  finished: 'bg-silver/10 text-silver border border-silver/30',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/40',
  pending: 'bg-ash/10 text-ash border border-ash/30',
  pending_payment: 'bg-neon-acid/15 text-neon-acid border border-neon-acid/40',
  confirmed: 'bg-neon/20 text-neon border border-neon/50',
  expired: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/40',
  current: 'bg-neon/20 text-neon border border-neon/50 shadow-neon-sm',
};

const PILL_LABELS: Record<string, string> = {
  open: 'Abierta',
  running: 'En marcha',
  finished: 'Finalizada',
  cancelled: 'Cancelada',
  pending: 'Pendiente',
  pending_payment: 'Pago pendiente',
  confirmed: 'Confirmada',
  expired: 'Expirada',
  current: 'Actual',
  draft: 'Borrador',
  active: 'Activa',
  closed: 'Cerrada',
  archived: 'Archivada',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const style = PILL_STYLES[status] ?? PILL_STYLES.pending;
  const text = label ?? PILL_LABELS[status] ?? status;
  return <span className={`pill ${style}`}>{text}</span>;
}



export function SectionTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div className="mb-5">
      {kicker && (
        <div className="font-mono text-neon/70 text-xs tracking-[0.3em] uppercase mb-1">{kicker}</div>
      )}
      <h2 className="font-display font-black italic text-2xl md:text-3xl text-silver skew-racing inline-block">
        {children}
      </h2>
      <div className="mt-2 h-px w-full bg-gradient-to-r from-neon/60 via-neon/15 to-transparent" />
    </div>
  );
}



export function IconTrophy({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" strokeLinecap="round" />
    </svg>
  );
}

export function IconWhatsApp({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 1.67a8.23 8.23 0 1 1-4.18 15.3l-.3-.17-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1 6.97-12.6Zm-3.1 4.06c-.18 0-.47.07-.72.34-.25.27-.94.93-.94 2.26 0 1.34.96 2.63 1.1 2.81.13.18 1.9 3.03 4.65 4.13 2.29.91 2.76.73 3.26.68.5-.04 1.6-.65 1.83-1.29.22-.63.22-1.18.16-1.29-.07-.11-.25-.18-.52-.31-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.6.13-.19.27-.7.89-.86 1.07-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.33-.8-.71-1.34-1.6-1.5-1.87-.15-.27-.01-.42.12-.55.13-.14.27-.34.4-.5.14-.18.18-.31.27-.5.09-.17.05-.34-.02-.48-.07-.13-.6-1.46-.83-1.99-.21-.51-.44-.44-.6-.45h-.52Z" />
    </svg>
  );
}

export function IconSpeed({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 4 4 20h16L12 4Z" strokeLinejoin="round" />
      <path d="M12 9v5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconFlag({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M5 3v18" strokeLinecap="round" />
      <path d="M5 4h13l-2.5 4L18 12H5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
