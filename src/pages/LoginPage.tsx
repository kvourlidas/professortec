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
  MapPin, Phone, ArrowLeft, Gift, CalendarDays, Sparkles,
  ClipboardList, Wallet, Users,
} from 'lucide-react';
import edraLogo from '../assets/edra-logo.png';

type Mode = 'login' | 'signup';
type SignupStep = 1 | 2 | 3 | 4;
type PlanId = 'free' | 'monthly' | 'yearly';

type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period?: string;
  label: string;
  crossedPrice?: string;
  monthlyEquiv?: string;
  highlighted?: boolean;
};

const FRONTISTIRIO_PLANS: Plan[] = [
  { id: 'free', name: 'Δωρεάν', price: '€0', label: '1 μήνας δωρεάν δοκιμή' },
  { id: 'monthly', name: 'Μηνιαίο', price: '€29', period: '/μήνα', label: 'Χωρίς δέσμευση' },
  { id: 'yearly', name: 'Ετήσιο', price: '€290', period: '/έτος', label: '2 μήνες δωρεάν', crossedPrice: '€348', highlighted: true },
];

const IDIAITEROU_PLANS: Plan[] = [
  { id: 'free', name: 'Δωρεάν', price: '€0', label: '1 μήνας δωρεάν δοκιμή' },
  { id: 'monthly', name: 'Μηνιαίο', price: '€20', period: '/μήνα', label: 'Χωρίς δέσμευση' },
  { id: 'yearly', name: 'Ετήσιο', price: '€216', period: '/έτος', label: 'Μία πληρωμή τον χρόνο' },
];

const FEATURES = [
  { icon: CalendarDays, label: 'Πρόγραμμα & Ημερολόγιο' },
  { icon: ClipboardList, label: 'Διαγωνίσματα & Βαθμοί' },
  { icon: Users, label: 'Μαθητές & Καθηγητές' },
  { icon: Wallet, label: 'Οικονομική διαχείριση' },
];

async function saveSchoolInfo(userId: string, info: { name: string; address: string; phone: string; email: string }) {
  let schoolId: string | null = null;
  for (let i = 0; i < 6 && !schoolId; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000));
    const { data: prof } = await supabase.from('profiles').select('school_id').eq('user_id', userId).maybeSingle();
    schoolId = prof?.school_id ?? null;
  }
  if (!schoolId) return;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;
  await supabase.functions.invoke('schoolinfo-update', {
    body: {
      school_id: schoolId,
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
  const { user, signInWeb, signUpWeb, authError, clearAuthError } = useAuth();
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

  // signup – step 4
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);

  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    clearAuthError();
    setStepError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw, signupEmail, signupPw, signupPwConfirm, infoName, accountType, mode, selectedPlan]);

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
    } else if (signupStep === 3) {
      if (!infoName.trim()) { setStepError('Το όνομα είναι υποχρεωτικό.'); return; }
      setSignupStep(4);
    }
  };

  const onSignup = async () => {
    if (!accountType) return;
    if (!selectedPlan) { setStepError('Επίλεξε πλάνο συνδρομής.'); return; }
    clearAuthError();
    setStepError(null);
    setPending(true);
    const result = await signUpWeb(signupEmail.trim(), signupPw, infoName.trim(), accountType);
    if (result === 'ok') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await saveSchoolInfo(session.user.id, { name: infoName, address: infoAddress, phone: infoPhone, email: infoEmail });
        }
      } catch {}
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
  const plans = isFrontistirio ? FRONTISTIRIO_PLANS : IDIAITEROU_PLANS;

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
        <div className={`w-full transition-[max-width] duration-300 ease-out ${
          mode === 'signup' && signupStep === 4 ? 'max-w-[760px]' : 'max-w-[480px]'
        }`}>

          {/* Tab switcher — underline text toggle */}
          <div className="mb-10 flex items-center gap-8 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgb(226 232 240)' }}>
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="relative pb-3.5 text-base font-bold tracking-tight transition-colors duration-150"
                style={{ color: mode === m ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}
              >
                {m === 'login' ? 'Σύνδεση' : 'Εγγραφή'}
                <span
                  className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity duration-200"
                  style={{ background: 'var(--color-accent)', opacity: mode === m ? 1 : 0 }}
                />
              </button>
            ))}
          </div>

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
                      <form onSubmit={e => { e.preventDefault(); goNext(); }} className="space-y-4">
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
                            className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98]"
                          >
                            Επόμενο
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Step 4 — Plan selection */}
                    {signupStep === 4 && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-main)]">Επιλογή πλάνου</h1>
                          <p className="text-sm text-[color:var(--color-text-muted)]">Επίλεξε το πλάνο που σου ταιριάζει καλύτερα.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-stretch pt-3">
                          {plans.map(plan => (
                            <PricingCard
                              key={plan.id}
                              isDark={isDark}
                              plan={plan}
                              selected={selectedPlan === plan.id}
                              onClick={() => setSelectedPlan(plan.id)}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSignupStep(3)}
                            className={`flex h-12 items-center justify-center rounded-lg border px-5 text-base transition active:scale-[0.98] ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={onSignup}
                            disabled={!selectedPlan || pending}
                            className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                          >
                            {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Εγγραφή…</> : 'Εγγραφή'}
                          </button>
                        </div>
                      </div>
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
  const steps = ['Τύπος', 'Λογαριασμός', 'Στοιχεία', 'Πλάνο'];
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

function PricingCard({
  isDark, plan, selected, onClick,
}: {
  isDark: boolean; plan: Plan; selected: boolean; onClick: () => void;
}) {
  const isHighlighted = !!plan.highlighted;
  const Icon = plan.id === 'free' ? Gift : plan.id === 'monthly' ? CalendarDays : Sparkles;
  const accent = plan.id === 'free' ? '#10b981' : plan.id === 'monthly' ? '#0ea5e9' : 'var(--color-accent)';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full flex-col rounded-2xl p-5 text-left transition-all duration-200 active:scale-[0.98] ${
        isDark ? 'bg-white/[0.03]' : 'bg-white/80'
      }`}
      style={{
        boxShadow: selected
          ? `0 0 0 2.5px ${accent}, 0 8px 24px color-mix(in srgb, ${accent} 30%, transparent)`
          : isHighlighted
            ? '0 0 0 1.5px color-mix(in srgb, var(--color-accent) 40%, transparent), 0 2px 10px color-mix(in srgb, var(--color-accent) 12%, transparent)'
            : isDark ? '0 0 0 1px rgba(255,255,255,0.08)' : '0 0 0 1px rgba(0,0,0,0.08)',
      }}
    >
      {isHighlighted && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm"
          style={{ background: 'var(--color-accent)' }}
        >
          ★ Best value
        </span>
      )}
      {selected && (
        <span
          className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: accent }}
        >
          <Check className="h-3 w-3" />
        </span>
      )}

      <div
        className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </div>

      <span className={`mb-2 text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
        {plan.name}
      </span>

      <div className="mb-0.5 flex flex-wrap items-baseline gap-1.5">
        {plan.crossedPrice && (
          <span className={`text-sm line-through ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {plan.crossedPrice}
          </span>
        )}
        <span className={`text-4xl font-extrabold tabular-nums ${
          isHighlighted ? 'text-[color:var(--color-accent)]' : isDark ? 'text-slate-100' : 'text-slate-800'
        }`}>
          {plan.price}
        </span>
        {plan.period && (
          <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {plan.period}
          </span>
        )}
      </div>

      {plan.monthlyEquiv && (
        <span className={`mb-2 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {plan.monthlyEquiv}
        </span>
      )}

      <span className={`mt-auto pt-3 text-xs font-medium leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {plan.label}
      </span>
    </button>
  );
}
