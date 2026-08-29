// src/components/LoadingScreen.tsx
import logoMark from '../assets/iconlogoedra.png';

export default function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ background: 'var(--color-background)' }}>
      <div
        className="pointer-events-none absolute h-[26rem] w-[26rem] animate-loading-halo-spin rounded-full blur-3xl"
        style={{
          background: 'conic-gradient(from 0deg, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent 30%, color-mix(in srgb, var(--color-accent) 22%, transparent) 60%, transparent 90%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-5">
        <div
          className="flex h-32 w-32 animate-pulse items-center justify-center rounded-[2rem] shadow-2xl"
          style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}
        >
          <img src={logoMark} alt="edra" className="h-[4.5rem] w-[4.5rem] rounded-2xl" />
        </div>
        <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Φόρτωση...</span>
      </div>
    </div>
  );
}
