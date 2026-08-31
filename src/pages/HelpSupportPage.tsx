import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import { HelpCircle, Mail, Phone, User, MessageSquare, ChevronDown, Send, CheckCircle2 } from 'lucide-react';
import StyledSelect from '../components/ui/StyledSelect';

const CATEGORIES = [
  'Τεχνικό πρόβλημα',
  'Οικονομικό θέμα',
  'Ερώτηση για λειτουργία',
  'Πρόταση βελτίωσης',
  'Άλλο',
];

export default function HelpSupportPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('schools').select('phone, email').eq('id', schoolId).maybeSingle();
      if (!error && data) { setContactPhone(data.phone ?? null); setContactEmail(data.email ?? null); }
    };
    load();
  }, [schoolId]);

  const name = profile?.full_name ?? '';
  const email = contactEmail || user?.email || '';
  const phone = contactPhone || '';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-10 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const labelCls = `block mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const emptyValueCls = isDark ? 'text-slate-600 italic' : 'text-slate-400 italic';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('support-contact', {
        body: { category, message, name, phone },
      });
      if (fnError) throw fnError;
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Δεν ήταν δυνατή η αποστολή. Δοκιμάστε ξανά.',
      );
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className={`${cardCls} flex flex-col items-center gap-4 px-10 py-14 text-center max-w-sm w-full`}>
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
          >
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </span>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Το μήνυμά σας στάλθηκε!
            </h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSubmitted(false); setMessage(''); setCategory(''); setError(null); }}
            className="mt-1 rounded-xl px-5 py-2 text-sm font-semibold transition active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            Νέο μήνυμα
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-2">
      <div className={`${cardCls} grid grid-cols-1 lg:grid-cols-5`}>

        {/* ── Left panel ── */}
        <div
          className="relative flex flex-col gap-8 overflow-hidden px-12 py-14 lg:col-span-2"
          style={{ background: 'var(--color-accent)' }}
        >
          <div className="relative z-10 space-y-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <HelpCircle className="h-5 w-5 text-white" />
            </span>

            <div>
              <h1 className="text-xl font-bold text-white">Βοήθεια &amp; Υποστήριξη</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Στείλτε μας το πρόβλημα ή την ερώτησή σας και θα σας απαντήσουμε το συντομότερο δυνατό.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Mail className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm text-white/80">support@edrahub.gr</span>
              </div>
            </div>
          </div>

          {/* Decorative watermark */}
          <span
            className="pointer-events-none select-none absolute right-0 font-black tracking-tighter text-white/[0.16]"
            style={{ fontSize: '480px', lineHeight: 0.82, top: '200px' }}
          >
            ?
          </span>
        </div>

        {/* ── Right panel (form) ── */}
        <div className="px-12 py-14 lg:col-span-3">
          <form onSubmit={onSubmit} className="space-y-5">

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className={labelCls}>
                  <User className="inline h-3 w-3 mr-1 opacity-60" />
                  Όνομα
                </label>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {name || <span className={emptyValueCls}>—</span>}
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  <Mail className="inline h-3 w-3 mr-1 opacity-60" />
                  Email
                </label>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {email || <span className={emptyValueCls}>—</span>}
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  <Phone className="inline h-3 w-3 mr-1 opacity-60" />
                  Τηλέφωνο
                </label>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {phone || <span className={emptyValueCls}>—</span>}
                </p>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <ChevronDown className="inline h-3 w-3 mr-1 opacity-60" />
                Κατηγορία
              </label>
              <div className="relative">
                <StyledSelect
                  isDark={isDark}
                  value={category}
                  onChange={setCategory}
                  placeholder="Επιλέξτε κατηγορία…"
                  className={`${inputCls} appearance-none pr-9 cursor-pointer`}
                  style={{ background: isDark ? undefined : 'rgb(248 250 252)' }}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                />
                <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <MessageSquare className="inline h-3 w-3 mr-1 opacity-60" />
                Μήνυμα
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={8}
                placeholder="Περιγράψτε το πρόβλημα ή την ερώτησή σας με όσο περισσότερες λεπτομέρειες μπορείτε…"
                required
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition resize-none ${
                  isDark
                    ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
                    : 'border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)] focus:bg-white focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
                }`}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-rose-500">{error}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-semibold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Αποστολή…' : 'Αποστολή'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
