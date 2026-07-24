// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { AccountType } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff, User, Building2, GraduationCap, CheckCircle2 } from 'lucide-react';
import logoDark from '../assets/edra-primary-transparent-dark(PNG).png';
import logoLight from '../assets/edra-primary-transparent-light(PNG)(1).png';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';
  const { user, signInWeb, signUpWeb, authError, clearAuthError } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<Mode>('login');

  // login fields
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    clearAuthError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw, signupEmail, signupPw, signupName, accountType, mode]);

  const onLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAuthError();
    setPending(true);
    const ok = await signInWeb(email.trim(), pw);
    setPending(false);
    if (ok) navigate(redirectTo, { replace: true });
  };

  const onSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accountType) return;
    clearAuthError();
    setPending(true);
    const result = await signUpWeb(signupEmail.trim(), signupPw, signupName.trim(), accountType);
    setPending(false);
    if (result === 'ok') navigate('/dashboard', { replace: true });
    if (result === 'confirm_email') setConfirmEmail(true);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearAuthError();
    setConfirmEmail(false);
  };

  /* ── shared background / card styles ── */
  const cardStyle = isDark ? {
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.028) 100%)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.08) inset',
    backdropFilter: 'blur(24px) saturate(1.4)',
  } : {
    border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
    background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
    boxShadow: '0 20px 60px color-mix(in srgb, var(--color-primary) 12%, transparent), 0 4px 16px rgba(0,0,0,0.06)',
    backdropFilter: 'blur(16px)',
  };

  const inputCls = `h-11 w-full rounded-xl border pl-10 pr-3.5 text-sm outline-none transition-all duration-200 ${
    isDark
      ? 'border-white/[0.08] bg-white/[0.05] text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
      : 'border-slate-200 bg-white/70 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/50 focus:bg-white focus:ring-2 focus:ring-[color:var(--color-accent)]/10'
  }`;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* ── DARK MODE BACKGROUND ── */}
      {isDark && (
        <>
          <div
            className="pointer-events-none absolute"
            style={{
              width: '700px', height: '700px',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -55%)',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 5%, transparent) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.022]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat', backgroundSize: '180px',
            }}
          />
        </>
      )}

      {/* ── LIGHT MODE BACKGROUND ── */}
      {!isDark && (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 0%, var(--color-butter) 0%, transparent 65%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 80%, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 70%)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 90% 20%, color-mix(in srgb, var(--color-butter) 45%, transparent) 0%, transparent 70%)' }} />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 30%, transparent) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
          />
        </>
      )}

      {/* ── Centered group ── */}
      <div className="relative z-10 flex flex-col items-center -mt-20">

        {/* Logo */}
        <img
          src={isDark ? logoDark : logoLight}
          alt="Edra"
          style={{ width: 620, maxWidth: '96vw', height: 'auto', marginBottom: 'max(-230px, -37vw)' }}
          className="object-contain drop-shadow-2xl"
          draggable={false}
        />

        {/* Card */}
        <div
          className="w-full max-w-[400px] overflow-hidden rounded-2xl"
          style={cardStyle}
        >
          {/* Tab switcher */}
          <div className="flex border-b" style={{ background: 'var(--ch-bg)', borderColor: 'var(--ch-divider)' }}>
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="relative flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors duration-150"
                style={{
                  color: mode === m ? 'var(--ch-text)' : 'var(--ch-text-muted)',
                  background: mode === m ? 'var(--ch-icon-bg)' : 'transparent',
                }}
              >
                {m === 'login' ? 'Σύνδεση' : 'Εγγραφή'}
                <span className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: mode === m ? 'var(--ch-text)' : 'transparent' }} />
              </button>
            ))}
          </div>

          <div className="px-8 py-7">

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <>
                <div className="mb-6 space-y-1">
                  <h1 className="text-lg font-bold tracking-tight text-[color:var(--color-text-main)]">Καλώς ήρθες!</h1>
                  <p className="text-xs text-[color:var(--color-text-muted)]">Σύνδεσε τον λογαριασμό σου.</p>
                </div>

                {authError && <ErrorBox isDark={isDark} msg={authError} />}

                <form onSubmit={onLogin} className="space-y-4">
                  <Field label="Email" isDark={isDark}>
                    <Mail className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="admin@school.gr" className={inputCls} />
                  </Field>

                  <Field label="Κωδικός" isDark={isDark}>
                    <Lock className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" placeholder="••••••••" className={`${inputCls} pr-10`} />
                    <ToggleEye show={showPw} toggle={() => setShowPw(v => !v)} isDark={isDark} />
                  </Field>

                  <button type="submit" disabled={pending} className="btn-primary mt-2 h-10 w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60">
                    {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Σύνδεση…</> : 'Σύνδεση'}
                  </button>
                </form>
              </>
            )}

            {/* ── SIGNUP ── */}
            {mode === 'signup' && (
              <>
                <div className="mb-6 space-y-1">
                  <h1 className="text-lg font-bold tracking-tight text-[color:var(--color-text-main)]">Δημιουργία λογαριασμού</h1>
                  <p className="text-xs text-[color:var(--color-text-muted)]">Επίλεξε τον τύπο του λογαριασμού σου.</p>
                </div>

                {confirmEmail ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center text-[color:var(--color-text-main)]">
                    <CheckCircle2 className="h-10 w-10 text-green-400" />
                    <p className="text-sm font-medium">Έλεγξε το email σου!</p>
                    <p className="text-xs text-[color:var(--color-text-muted)]">Στείλαμε σύνδεσμο επιβεβαίωσης στο <span className="font-semibold">{signupEmail}</span>.</p>
                    <button type="button" onClick={() => switchMode('login')} className="mt-2 text-xs underline text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)]">Πίσω στη σύνδεση</button>
                  </div>
                ) : (
                  <>
                    {authError && <ErrorBox isDark={isDark} msg={authError} />}

                    <form onSubmit={onSignup} className="space-y-4">
                      {/* Account type cards */}
                      <div className="grid grid-cols-2 gap-3 mb-1">
                        <AccountTypeCard
                          isDark={isDark}
                          selected={accountType === 'frontistirio'}
                          onClick={() => setAccountType('frontistirio')}
                          icon={<Building2 className="h-6 w-6" />}
                          title="Φροντιστήριο"
                          sub="Διαχείριση σχολείου"
                        />
                        <AccountTypeCard
                          isDark={isDark}
                          selected={accountType === 'idiaiterou'}
                          onClick={() => setAccountType('idiaiterou')}
                          icon={<GraduationCap className="h-6 w-6" />}
                          title="Ιδιαίτερα"
                          sub="Καθηγητής ιδ/ρων"
                        />
                      </div>

                      <Field label="Ονοματεπώνυμο" isDark={isDark}>
                        <User className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type="text" value={signupName} onChange={e => setSignupName(e.target.value)} required placeholder="Γιώργης Παπαδόπουλος" className={inputCls} />
                      </Field>

                      <Field label="Email" isDark={isDark}>
                        <Mail className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required autoComplete="email" placeholder="admin@school.gr" className={inputCls} />
                      </Field>

                      <Field label="Κωδικός" isDark={isDark}>
                        <Lock className={`absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type={showSignupPw ? 'text' : 'password'} value={signupPw} onChange={e => setSignupPw(e.target.value)} required autoComplete="new-password" placeholder="••••••••" minLength={6} className={`${inputCls} pr-10`} />
                        <ToggleEye show={showSignupPw} toggle={() => setShowSignupPw(v => !v)} isDark={isDark} />
                      </Field>

                      <button
                        type="submit"
                        disabled={pending || !accountType}
                        className="btn-primary mt-2 h-10 w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                      >
                        {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Εγγραφή…</> : 'Εγγραφή'}
                      </button>
                    </form>
                  </>
                )}
              </>
            )}

          </div>
        </div>

        {/* Subtitle */}
        <p
          className="mt-3 text-[11px] tracking-widest uppercase font-semibold"
          style={{ color: isDark ? 'rgba(255,255,255,0.18)' : 'color-mix(in srgb, var(--color-text-muted) 70%, transparent)' }}
        >
          Διαχειριση Φροντιστηριου
        </p>

      </div>
    </div>
  );
}

/* ── small helpers ── */

function ErrorBox({ isDark, msg }: { isDark: boolean; msg: string }) {
  return (
    <div className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
      isDark ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-600'
    }`}>
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {msg}
    </div>
  );
}

function Field({ label, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}

function ToggleEye({ show, toggle, isDark }: { show: boolean; toggle: () => void; isDark: boolean }) {
  return (
    <button type="button" onClick={toggle} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
      {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

function AccountTypeCard({
  isDark, selected, onClick, icon, title, sub,
}: {
  isDark: boolean; selected: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all duration-150 ${
        selected
          ? isDark
            ? 'border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/10 text-white'
            : 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/8 text-slate-800'
          : isDark
            ? 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
            : 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {selected && (
        <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-[color:var(--color-accent)]" />
      )}
      <span className={selected ? 'text-[color:var(--color-accent)]' : ''}>{icon}</span>
      <span className="text-xs font-bold leading-tight">{title}</span>
      <span className="text-[10px] leading-tight opacity-60">{sub}</span>
    </button>
  );
}
