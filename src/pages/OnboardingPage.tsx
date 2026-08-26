// src/pages/OnboardingPage.tsx
import { Fragment, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { AccountType } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import {
  Loader2, AlertCircle, User, Building2, GraduationCap,
  CheckCircle2, Check, MapPin, Phone, ArrowLeft,
} from 'lucide-react';
import edraLogo from '../assets/edra-logo.png';

type OnboardingStep = 1 | 2;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<OnboardingStep>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [infoName, setInfoName] = useState(profile?.full_name ?? '');
  const [infoAddress, setInfoAddress] = useState('');
  const [infoPhone, setInfoPhone] = useState('');

  const isFrontistirio = accountType === 'frontistirio';

  const inputCls = `h-12 w-full border-b bg-transparent pl-7 pr-8 text-base outline-none transition-colors duration-200 ${
    isDark
      ? 'border-white/15 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]'
      : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
  }`;

  const goNext = () => {
    setStepError(null);
    if (!accountType) { setStepError('Επίλεξε τύπο λογαριασμού.'); return; }
    setStep(2);
  };

  const onFinish = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStepError(null);
    if (!accountType) return;
    if (!infoName.trim()) { setStepError('Το όνομα είναι υποχρεωτικό.'); return; }

    setPending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No session');

      const { error } = await supabase.functions.invoke('signup-school-create', {
        body: {
          name: infoName.trim(),
          address: infoAddress.trim() || null,
          phone: infoPhone.trim() || null,
          email: null,
          account_type: accountType,
          full_name: infoName.trim(),
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;

      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch {
      setStepError('Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" style={{ background: 'var(--color-background)' }}>
      <div className="relative flex shrink-0 flex-col justify-end overflow-hidden px-6 py-6 lg:w-[42%] lg:px-14 lg:py-14 xl:w-[38%]" style={{ background: 'var(--color-accent)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative z-10 hidden lg:block">
          <img src={edraLogo} alt="Edra" className="h-28 w-auto object-contain xl:h-36" draggable={false} />
          <h2 className="mt-9 text-[34px] font-bold leading-tight text-white xl:text-[40px]">
            Λίγα ακόμα στοιχεία και είσαι έτοιμος/η.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
            Πριν μπεις στον λογαριασμό σου, πες μας λίγα πράγματα ώστε να στήσουμε το edra για σένα.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-[480px]">
          <StepIndicator step={step} isDark={isDark} />

          {stepError && <ErrorBox isDark={isDark} msg={stepError} />}

          {step === 1 && (
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

          {step === 2 && (
            <form onSubmit={onFinish} className="space-y-4">
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
                  onClick={() => setStep(1)}
                  className={`flex h-12 items-center justify-center rounded-lg border px-5 text-base transition active:scale-[0.98] ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 rounded-lg text-base font-medium tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  {pending ? <><Loader2 className="h-4 w-4 animate-spin" />Ολοκλήρωση…</> : 'Ολοκλήρωση'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function StepIndicator({ step, isDark }: { step: OnboardingStep; isDark: boolean }) {
  const steps = ['Τύπος', 'Στοιχεία'];
  return (
    <div className="flex items-start justify-center mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as OnboardingStep;
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
