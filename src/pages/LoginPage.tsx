// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Loader2, GraduationCap, Mail, Lock } from 'lucide-react';

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
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #4b5c70 0%, #253649 45%, #020617 100%)'
          : 'linear-gradient(135deg, #e0eaff 0%, #f0f4ff 50%, #fafbff 100%)',
      }}
    >
      {/* Decorative blobs */}
      {isDark ? (
        <>
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}/>
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}/>
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 30%, transparent) 0%, transparent 70%)' }}/>
          <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 20%, transparent) 0%, transparent 70%)' }}/>
        </>
      )}

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl ${
          isDark
            ? 'border border-white/10 bg-white/[0.04] backdrop-blur-xl'
            : 'border border-slate-200 bg-white'
        }`}
      >
        {/* Accent top stripe */}
        <div
          className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 40%, transparent))' }}
        />

        <div className="px-8 py-8">
          {/* Logo mark */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, #000))' }}
            >
              <GraduationCap className="h-7 w-7 text-black" />
            </div>
            <div className="text-center">
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                Tutor Admin
              </h1>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σύνδεση διαχειριστή φροντιστηρίου
              </p>
            </div>
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@school.gr"
                  className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm outline-none transition ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-900/50 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                      : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Κωδικός
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="password"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`h-10 w-full rounded-xl border pl-9 pr-3 text-sm outline-none transition ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-900/50 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                      : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                  }`}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-black shadow-md transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Σύνδεση…</>
              ) : (
                'Σύνδεση'
              )}
            </button>
          </form>
        </div>

        {/* Bottom decoration */}
        <div
          className={`px-8 py-3 text-center text-[10px] ${isDark ? 'border-t border-white/5 text-slate-600' : 'border-t border-slate-100 text-slate-400'}`}
        >
          ProfessorTec © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}