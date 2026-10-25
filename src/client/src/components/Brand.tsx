interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  showMascot?: boolean;
}

/** Marca tipográfica ALANBREX: "ALANBRE" en plateado + "X" en verde neón con glow. */
export default function Brand({ size = 'md', showMascot = true }: BrandProps) {
  const textSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  const mascotSize = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';

  return (
    <div className="flex items-center gap-3 select-none">
      {showMascot && (
        <img
          src="/branding/logo-mascot.jpg"
          alt="ALANBREX"
          className={`${mascotSize} rounded-lg object-cover border border-neon/40 shadow-neon-sm`}
          draggable={false}
        />
      )}
      <div className="leading-none">
        <div className={`font-display font-black italic ${textSize} tracking-tight`}>
          <span className="text-silver">ALANBRE</span>
          <span className="text-neon text-glow">X</span>
        </div>
        <div className="font-tech text-[10px] tracking-[0.35em] text-ash uppercase mt-1">
          Hot Wheels Racing
        </div>
      </div>
    </div>
  );
}
