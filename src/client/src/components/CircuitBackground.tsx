
export default function CircuitBackground({ fixed = true }: { fixed?: boolean }) {
  return (
    <div
      aria-hidden
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 pointer-events-none overflow-hidden`}
    >
      <div className="absolute inset-0 circuit-bg" />
      <div className="absolute inset-0 dot-grid opacity-50" />
      <div className="absolute -top-44 -left-44 w-[540px] h-[540px] rounded-full bg-neon/10 blur-[130px]" />
      <div className="absolute -bottom-44 -right-44 w-[540px] h-[540px] rounded-full bg-neon-bright/10 blur-[130px]" />
      <div className="absolute top-1/3 left-1/2 w-[420px] h-[420px] -translate-x-1/2 rounded-full bg-neon/[0.05] blur-[140px]" />
    </div>
  );
}
