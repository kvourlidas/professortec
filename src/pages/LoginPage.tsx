// src/pages/LoginPage.tsx
import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { AccountType } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import {
  Loader2, Mail, Lock, AlertCircle, Eye, EyeOff,
  User, Building2, GraduationCap, CheckCircle2, Check,
  MapPin, Phone, ArrowLeft, CalendarDays,
  ClipboardList, Wallet, Users, LogIn, UserPlus,
} from 'lucide-react';
import edraLogo from '../assets/edra-logo.png';
import FolderTabs from '../components/ui/FolderTabs';

type Mode = 'login' | 'signup';
type SignupStep = 1 | 2 | 3;

const FEATURES = [
  { icon: CalendarDays, label: 'Πρόγραμμα & Ημερολόγιο' },
  { icon: ClipboardList, label: 'Διαγωνίσματα & Βαθμοί' },
  { icon: Users, label: 'Μαθητές & Καθηγητές' },
  { icon: Wallet, label: 'Οικονομική διαχείριση' },
];

async function createSignupSchool(info: { name: string; address: string; phone: string; email: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;
  await supabase.functions.invoke('signup-school-create', {
    body: {
      name: info.name.trim(),
      address: info.address.trim() || null,
      phone: info.phone.trim() || null,
      email: info.email.trim() || null,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';
  const { user, signInWeb, signUpWeb, signInWithGoogle, authError, clearAuthError } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<Mode>('login');

  // login
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // signup – step 1
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  // signup – step 2
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [signupPwConfirm, setSignupPwConfirm] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupPwConfirm, setShowSignupPwConfirm] = useState(false);

  // signup – step 3
  const [infoName, setInfoName] = useState('');
  const [infoAddress, setInfoAddress] = useState('');
  const [infoPhone, setInfoPhone] = useState('');
  const [infoEmail, setInfoEmail] = useState('');

  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const onGoogleSignIn = async () => {
    setGooglePending(true);
    await signInWithGoogle();
    setGooglePending(false);
  };

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    clearAuthError();
    setStepError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw, signupEmail, signupPw, signupPwConfirm, infoName, accountType, mode]);

  const onLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAuthError();
    setPending(true);
    const ok = await signInWeb(email.trim(), pw);
    setPending(false);
    if (ok) navigate(redirectTo, { replace: true });
  };

  const goNext = () => {
    setStepError(null);
    if (signupStep === 1) {
      if (!accountType) { setStepError('Επίλεξε τύπο λογαριασμού.'); return; }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!signupEmail.trim()) { setStepError('Το email είναι υποχρεωτικό.'); return; }
      if (signupPw.length < 6) { setStepError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'); return; }
      if (signupPw !== signupPwConfirm) { setStepError('Οι κωδικοί δεν ταιριάζουν.'); return; }
      setInfoEmail(prev => prev || signupEmail.trim());
      setSignupStep(3);
    }
  };

  const onSignup = async () => {
    if (!accountType) return;
    if (!infoName.trim()) { setStepError('Το όνομα είναι υποχρεωτικό.'); return; }
    clearAuthError();
    setStepError(null);
    setPending(true);
    const result = await signUpWeb(signupEmail.trim(), signupPw, infoName.trim(), accountType);
    if (result === 'ok') {
      try {
        await createSignupSchool({ name: infoName, address: infoAddress, phone: infoPhone, email: infoEmail });
      } catch (e) {
        console.error('Failed to create school on signup', e);
      }
      navigate('/dashboard', { replace: true });
    } else if (result === 'confirm_email') {
      setConfirmEmail(true);
    }
    setPending(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearAuthError();
    setConfirmEmail(false);
    setSignupStep(1);
    setStepError(null);
  };

  const inputCls = `h-12 w-full border-b bg-transparent pl-7 pr-8 text-base outline-none transition-colors duration-200 ${
    isDark
      ? 'border-white/15 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]'
      : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
  }`;

  const isFrontistirio = accountType === 'frontistirio';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" style={{ background: 'var(--color-background)' }}>

      {/* ── Brand panel ── */}
      <div className="relative flex shrink-0 flex-col justify-end overflow-hidden px-6 py-6 lg:w-[42%] lg:px-14 lg:py-14 xl:w-[38%]" style={{ background: 'var(--color-accent)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative z-10 hidden lg:block">
          <img src={edraLogo} alt="Edra" className="h-28 w-auto object-contain xl:h-36" draggable={false} />
          <h2 className="mt-9 text-[34px] font-bold leading-tight text-white xl:text-[40px]">
            Η διαχείριση του φροντιστηρίου σου, απλοποιημένη.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
            Πρόγραμμα, μαθητές, βαθμοί και οικονομικά — όλα σε ένα μέρος, σχεδιασμένα για να σου γλιτώνουν χρόνο κάθε μέρα.
          </p>
          <div className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <span className="text-base font-medium text-white/90">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-white/40">
            Διαχείριση Φροντιστηρίου
          </p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-[480px]">

          {/* Tab switcher */}
          <FolderTabs
            className="mb-10"
            isDark={isDark}
            active={mode}
            onChange={switchMode}
            tabs={[
              { key: 'login', label: 'Σύνδεση', icon: LogIn },
              { key: 'signup', label: 'Εγγραφή', icon: UserPlus },
            ]}
          />

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <>
                <div className="mb-6 space-y-1">
                  <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-main)]">Καλώς ήρθες!</h1>
                  <p className="text-sm text-[color:var(--color-text-muted)]">Σύνδεση τον λογαριασμό σου.</p>
                </div>
                {authError && <ErrorBox isDark={isDark} msg={authError} />}
                <form onSubmit={onLogin} className="space-y-4">
                  <Field label="Email" isDark={isDark}>
                    <Mail className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="admin@school.gr" className={inputCls} />
                  </Field>
                  <Field label="Κωδικός" isDark={isDark}>
                    <Lock className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" placeholder="••••••••" className={`${inputCls} pr-10`} />
                    <ToggleEye show={showPw} toggle={() => setShowPw(v => !v)} isDark={isDark} />
                  </Field>
                  <button type="submit" disabled={pending} className="btn-primary mt-2 h-12 w-full flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60">
                    {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Σύνδεση…</> : 'Σύνδεση'}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <span className={`text-xs font-medium uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>ή</span>
                  <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                </div>

                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googlePending}
                  className={`flex h-12 w-full items-center justify-center gap-3 rounded-lg border text-base font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-60 ${
                    isDark
                      ? 'border-white/15 text-slate-100 hover:bg-white/5'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {googlePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                  Συνέχεια με Google
                </button>
              </>
            )}

            {/* ── SIGNUP ── */}
            {mode === 'signup' && (
              <>
                {confirmEmail ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-400" />
                    <p className="text-sm font-semibold text-[color:var(--color-text-main)]">Έλεγξε το email σου!</p>
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      Στείλαμε σύνδεσμο επιβεβαίωσης στο{' '}
                      <span className="font-semibold text-[color:var(--color-text-main)]">{signupEmail}</span>.
                    </p>
                    <button type="button" onClick={() => switchMode('login')} className="mt-2 text-xs underline text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)]">
                      Πίσω στη σύνδεση
                    </button>
                  </div>
                ) : (
                  <>
                    <StepIndicator step={signupStep} isDark={isDark} />

                    {(stepError || authError) && <ErrorBox isDark={isDark} msg={stepError ?? authError!} />}

                    {/* Step 1 — Account type */}
                    {signupStep === 1 && (
                      <div className="space-y-5">
                        <div className="space-y-1">
                          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-main)]">Τύπος λογαριασμού</h1>
                          <p className="text-sm text-[color:var(--color-text-muted)]">Επίλεξε πώς θα χρησιμοποιείς το edra.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <AccountTypeCard
                            isDark={isDark}
                            selected={accountType === 'frontistirio'}
                            onClick={() => setAccountType('frontistirio')}
                            icon={<Building2 className="h-7 w-7" />}
                            title="Φροντιστήριο"
                            sub="Διαχείριση σχολείου"
                          />
                          <AccountTypeCard
                            isDark={isDark}
                            selected={accountType === 'idiaiterou'}
                            onClick={() => setAccountType('idiaiterou')}
                            icon={<GraduationCap className="h-7 w-7" />}
                            title="Ιδιαίτερα"
                            sub="Καθηγητής ιδ/ρων"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={goNext}
                          disabled={!accountType}
                          className="btn-primary h-12 w-full flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                        >
                          Επόμενο
                        </button>
                      </div>
                    )}

                    {/* Step 2 — Email + Password */}
                    {signupStep === 2 && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-main)]">Στοιχεία λογαριασμού</h1>
                          <p className="text-sm text-[color:var(--color-text-muted)]">Email και κωδικός πρόσβασης.</p>
                        </div>
                        <Field label="Email" isDark={isDark}>
                          <Mail className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} autoComplete="email" placeholder="admin@school.gr" className={inputCls} autoFocus />
                        </Field>
                        <Field label="Κωδικός" isDark={isDark}>
                          <Lock className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type={showSignupPw ? 'text' : 'password'} value={signupPw} onChange={e => setSignupPw(e.target.value)} autoComplete="new-password" placeholder="••••••••" minLength={6} className={`${inputCls} pr-10`} />
                          <ToggleEye show={showSignupPw} toggle={() => setShowSignupPw(v => !v)} isDark={isDark} />
                        </Field>
                        <Field label="Επιβεβαίωση κωδικού" isDark={isDark}>
                          <Lock className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type={showSignupPwConfirm ? 'text' : 'password'} value={signupPwConfirm} onChange={e => setSignupPwConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" className={`${inputCls} pr-10`} />
                          <ToggleEye show={showSignupPwConfirm} toggle={() => setShowSignupPwConfirm(v => !v)} isDark={isDark} />
                        </Field>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSignupStep(1)}
                            className={`flex h-12 items-center justify-center rounded-lg border px-5 text-base transition active:scale-[0.98] ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={goNext} className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98]">
                            Επόμενο
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3 — School / personal info */}
                    {signupStep === 3 && (
                      <form onSubmit={e => { e.preventDefault(); onSignup(); }} className="space-y-4">
                        <div className="space-y-1">
                          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-main)]">
                            {isFrontistirio ? 'Στοιχεία σχολείου' : 'Στοιχεία σας'}
                          </h1>
                          <p className="text-sm text-[color:var(--color-text-muted)]">Συμπληρώστε τα βασικά στοιχεία επικοινωνίας.</p>
                        </div>

                        <Field label={isFrontistirio ? 'Επωνυμία σχολείου' : 'Ονοματεπώνυμο'} isDark={isDark}>
                          <User className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input
                            type="text"
                            value={infoName}
                            onChange={e => setInfoName(e.target.value)}
                            required
                            placeholder={isFrontistirio ? 'π.χ. Φροντιστήριο Αθηνά' : 'π.χ. Γιώργης Παπαδόπουλος'}
                            className={inputCls}
                            autoFocus
                          />
                        </Field>

                        <Field label="Διεύθυνση" isDark={isDark}>
                          <MapPin className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type="text" value={infoAddress} onChange={e => setInfoAddress(e.target.value)} placeholder="π.χ. Λεωφόρος Αθηνών 42" className={inputCls} />
                        </Field>

                        <Field label="Τηλέφωνο" isDark={isDark}>
                          <Phone className={`absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type="tel" value={infoPhone} onChange={e => setInfoPhone(e.target.value)} placeholder="210 123 4567" className={inputCls} />
                        </Field>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSignupStep(2)}
                            className={`flex h-12 items-center justify-center rounded-lg border px-5 text-base transition active:scale-[0.98] ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="submit"
                            disabled={pending}
                            className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                          >
                            {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Εγγραφή…</> : 'Εγγραφή'}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            )}

          <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-widest lg:hidden" style={{ color: 'var(--color-text-muted)' }}>
            Διαχείριση Φροντιστηρίου
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function StepIndicator({ step, isDark }: { step: SignupStep; isDark: boolean }) {
  const steps = ['Τύπος', 'Λογαριασμός', 'Στοιχεία'];
  return (
    <div className="flex items-start justify-center mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as SignupStep;
        const active = n === step;
        const done = n < step;
        return (
          <Fragment key={label}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  done || active ? 'text-white' : isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
                style={{
                  background: done || active
                    ? 'var(--color-accent)'
                    : isDark ? 'rgba(255,255,255,0.06)' : 'rgb(241 245 249)',
                  boxShadow: active
                    ? '0 0 0 5px color-mix(in srgb, var(--color-accent) 16%, transparent), 0 4px 14px color-mix(in srgb, var(--color-accent) 35%, transparent)'
                    : 'none',
                }}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors duration-300 ${
                active ? 'text-[color:var(--color-accent)]' : isDark ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mt-[18px] h-[2px] w-9 flex-shrink-0 overflow-hidden rounded-full mx-1"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgb(226 232 240)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: done ? '100%' : '0%', background: 'var(--color-accent)' }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function ErrorBox({ isDark, msg }: { isDark: boolean; msg: string }) {
  return (
    <div className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
      isDark ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-600'
    }`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

function Field({ label, children }: { label: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-bold uppercase tracking-widest text-[color:var(--color-text-muted)]">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}

function ToggleEye({ show, toggle, isDark }: { show: boolean; toggle: () => void; isDark: boolean }) {
  return (
    <button type="button" onClick={toggle} className={`absolute right-0 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      className={`relative flex flex-col items-center gap-2.5 rounded-xl border px-4 py-5 text-center transition-all duration-150 ${
        selected
          ? isDark
            ? 'border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/10 text-white'
            : 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/8 text-slate-800'
          : isDark
            ? 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
            : 'border-slate-200 bg-white/50 text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {selected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-[color:var(--color-accent)]" />}
      <span className={selected ? 'text-[color:var(--color-accent)]' : ''}>{icon}</span>
      <span className="text-sm font-bold leading-tight">{title}</span>
      <span className="text-xs leading-tight opacity-60">{sub}</span>
    </button>
  );
}

