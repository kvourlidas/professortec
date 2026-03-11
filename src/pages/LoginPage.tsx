// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import logoDark from '../assets/edra-primary-transparent-dark(PNG).png';
import logoLight from '../assets/edra-primary-transparent-light(PNG)(1).png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, signInWeb, authError, clearAuthError } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (authError) clearAuthError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAuthError();
    setPending(true);
    const ok = await signInWeb(email.trim(), pw);
    setPending(false);
    if (!ok) return;
    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
      style={{
        background: isDark
          ? '#0b0d11'
          : '#f5f6fa',
      }}
    >
      {/* ── DARK MODE BACKGROUND ── */}
      {isDark && (
        <>
          {/* Single very soft centered accent glow — barely there */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: '700px',
              height: '700px',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -55%)',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 5%, transparent) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          {/* Noise grain for texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.022]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '180px',
            }}
          />
        </>
      )}

      {/* ── LIGHT MODE BACKGROUND ── */}
      {!isDark && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 0%, #e8eeff 0%, transparent 65%)' }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 80%, color-mix(in srgb, var(--color-accent) 8%, transparent) 0%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 50% 40% at 90% 20%, color-mix(in srgb, var(--color-accent) 6%, transparent) 0%, transparent 70%)' }}
          />
          {/* Soft dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </>
      )}

      {/* ── Centered group: logo + card + subtitle ── */}
      <div className="relative z-10 flex flex-col items-center -mt-20">

        {/* ── Logo ── */}
        <img
          src={isDark ? logoDark : logoLight}
          alt="Edra"
          style={{ width: 620, maxWidth: '96vw', height: 'auto', marginBottom: '-230px' }}
          className="object-contain drop-shadow-2xl"
          draggable={false}
        />

        {/* ── Card ── */}
        <div
          className="w-full max-w-[380px] overflow-hidden rounded-2xl"
          style={isDark ? {
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.028) 100%)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.08) inset',
            backdropFilter: 'blur(24px) saturate(1.4)',
          } : {
            border: '1px solid rgba(203,213,225,0.7)',
            background: 'rgba(255,255,255,0.85)',
            boxShadow: '0 20px 60px rgba(99,102,241,0.08), 0 4px 16px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Shimmer top stripe */}
          <div
            className="h-[3px] w-full"
            style={{
              background: isDark
                ? 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 30%, transparent), var(--color-accent), color-mix(in srgb, var(--color-accent) 50%, #a78bfa), color-mix(in srgb, var(--color-accent) 20%, transparent))'
                : 'linear-gradient(90deg, transparent, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, #818cf8), transparent)',
            }}
          />

          <div className="px-8 py-8">
            {/* Heading */}
            <div className="mb-7 space-y-1">
              <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Καλώς ήρθες!
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                Σύνδεσε τον λογαριασμό διαχειριστή σου.
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
                isDark ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-600'
              }`}>
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {authError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@school.gr"
                    className={`h-11 w-full rounded-xl border pl-10 pr-3.5 text-sm outline-none transition-all duration-200 ${
                      isDark
                        ? 'border-white/[0.08] bg-white/[0.05] text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
                        : 'border-slate-200 bg-white/70 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/50 focus:bg-white focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Κωδικός
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="password"
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`h-11 w-full rounded-xl border pl-10 pr-3.5 text-sm outline-none transition-all duration-200 ${
                      isDark
                        ? 'border-white/[0.08] bg-white/[0.05] text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
                        : 'border-slate-200 bg-white/70 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/50 focus:bg-white focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
                    }`}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="btn-primary mt-2 h-10 w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                style={isDark ? {
                  background: '#f3b421',
                  color: '#000000',
                  borderColor: 'color-mix(in srgb, #f3b421 75%, white 25%)',
                } : {
                  background: '#2563eb',
                  color: '#ffffff',
                  borderColor: 'color-mix(in srgb, #2563eb 75%, white 25%)',
                }}
              >
                {pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Σύνδεση…</>
                ) : (
                  'Σύνδεση'
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Subtitle */}
        <p
          className="mt-3 text-[11px] tracking-widest uppercase font-semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.6)' }}
        >
          Διαχειριση Φροντιστηριου
        </p>

      </div>
    </div>
  );
}