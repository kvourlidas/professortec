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
          ? 'linear-gradient(145deg, #0d1117 0%, #131c2e 50%, #0a0f1a 100%)'
          : 'linear-gradient(145deg, #f0f4ff 0%, #e8eeff 40%, #f8f9ff 100%)',
      }}
    >
      {/* Background blobs */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, var(--color-accent) ${isDark ? '12%' : '18%'}, transparent) 0%, transparent 65%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, var(--color-accent) ${isDark ? '8%' : '12%'}, transparent) 0%, transparent 65%)` }}
      />
      {isDark && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(var(--color-accent) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center">

        {/* ── Logo ── */}
        <img
          src={isDark ? logoDark : logoLight}
          alt="Edra"
          style={{ width: 620, maxWidth: '96vw', height: 'auto' }}
          className="object-contain drop-shadow-2xl"
          draggable={false}
        />

        {/* ── Card ── */}
        <div
          style={{ marginTop: '-200px' }}
          className={`w-full max-w-[380px] overflow-hidden rounded-2xl ${
            isDark
              ? 'border border-white/[0.08] bg-white/[0.04] shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl ring-1 ring-inset ring-white/[0.06]'
              : 'border border-slate-200/80 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.1)]'
          }`}
        >
          {/* Accent top stripe */}
          <div
            className="h-[3px] w-full"
            style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 40%, #818cf8))' }}
          />

          <div className="px-8 py-8">
            {/* Heading */}
            <div className="mb-7 space-y-1">
              <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                Καλώς ήρθες!
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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
                  <Mail className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="admin@school.gr"
                    className={`h-11 w-full rounded-xl border pl-10 pr-3.5 text-sm outline-none transition ${
                      isDark
                        ? 'border-white/10 bg-white/[0.06] text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/50 focus:bg-white/[0.09] focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
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
                  <Lock className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                  <input
                    type="password"
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`h-11 w-full rounded-xl border pl-10 pr-3.5 text-sm outline-none transition ${
                      isDark
                        ? 'border-white/10 bg-white/[0.06] text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/50 focus:bg-white/[0.09] focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                    }`}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="btn-primary mt-2 h-11 w-full justify-center gap-2 rounded-xl text-sm font-semibold shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Σύνδεση…</>
                ) : (
                  'Σύνδεση'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className={`px-8 py-3 text-center text-[10px] ${isDark ? 'border-t border-white/[0.06] text-slate-700' : 'border-t border-slate-100 text-slate-400'}`}>
            ProfessorTec © {new Date().getFullYear()}
          </div>
        </div>

        {/* Subtitle */}
        <p className={`mt-3 text-[11px] tracking-widest uppercase font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Διαχείριση Φροντιστηρίου
        </p>

      </div>
    </div>
  );
}