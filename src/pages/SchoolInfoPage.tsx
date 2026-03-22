// src/pages/SchoolInfoPage.tsx
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Building2, MapPin, Phone, Mail, Loader2, CheckCircle2, Pencil, X } from 'lucide-react';
import type { SchoolForm, SchoolRow } from '../components/school-info/types';
import { emptyForm } from '../components/school-info/types';

// ── Edge function helper ──────────────────────────────────────────────────────
async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.error) throw new Error(res.error.message ?? 'Edge function error');
  return res.data;
}

export default function SchoolInfoPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [saved, setSaved] = useState<SchoolForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Styles ──
  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const readonlyCls = isDark
    ? 'flex h-10 w-full items-center rounded-xl border border-slate-700/40 bg-slate-900/30 px-3 text-sm text-slate-200'
    : 'flex h-10 w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700';

  const emptyValueCls = isDark ? 'text-slate-600 italic' : 'text-slate-400 italic';
  const labelCls = `block mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const iconCls = `h-3.5 w-3.5 inline-block mr-1.5 opacity-60`;

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, address, phone, email')
        .eq('id', schoolId)
        .maybeSingle();
      if (!error && data) {
        const row = data as SchoolRow;
        const loaded = {
          name: row.name ?? '',
          address: row.address ?? '',
          phone: row.phone ?? '',
          email: row.email ?? '',
        };
        setForm(loaded);
        setSaved(loaded);
      }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const handleChange = (field: keyof SchoolForm) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  };

  // ── Update via edge function ──────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    if (!form.name.trim()) { setError('Το όνομα σχολείου είναι υποχρεωτικό.'); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      await callEdgeFunction('schoolinfo-update', {
        school_id: schoolId,
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      setSaved(form);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(saved);
    setEditing(false);
    setError(null);
  };

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <Building2 className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Πληροφορίες Σχολείου
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Διαχειριστείτε τα βασικά στοιχεία του σχολείου σας.
            </p>
          </div>
        </div>
        {!loading && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-[0.97] ${
              isDark
                ? 'border-slate-700/70 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Επεξεργασία
          </button>
        )}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-300 backdrop-blur">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          Οι αλλαγές αποθηκεύτηκαν με επιτυχία.
        </div>
      )}

      {/* ── Form card ── */}
      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`h-6 w-6 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">

              {/* School Name */}
              <div>
                <label className={labelCls}>
                  <Building2 className={iconCls} />
                  Επωνυμία Σχολείου
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="π.χ. Φροντιστήριο Αθηνά"
                    className={inputCls}
                    required
                    autoFocus
                  />
                ) : (
                  <div className={readonlyCls}>
                    <span className={form.name ? '' : emptyValueCls}>{form.name || '—'}</span>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label className={labelCls}>
                  <MapPin className={iconCls} />
                  Διεύθυνση
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={form.address}
                    onChange={handleChange('address')}
                    placeholder="π.χ. Λεωφόρος Αθηνών 42, Αθήνα 10434"
                    className={inputCls}
                  />
                ) : (
                  <div className={readonlyCls}>
                    <span className={form.address ? '' : emptyValueCls}>{form.address || '—'}</span>
                  </div>
                )}
              </div>

              {/* Phone + Email side by side */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <Phone className={iconCls} />
                    Τηλέφωνο
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={handleChange('phone')}
                      placeholder="π.χ. 210 123 4567"
                      className={inputCls}
                    />
                  ) : (
                    <div className={readonlyCls}>
                      <span className={form.phone ? '' : emptyValueCls}>{form.phone || '—'}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    <Mail className={iconCls} />
                    Email
                  </label>
                  {editing ? (
                    <input
                      type="email"
                      value={form.email}
                      onChange={handleChange('email')}
                      placeholder="π.χ. info@school.gr"
                      className={inputCls}
                    />
                  ) : (
                    <div className={readonlyCls}>
                      <span className={form.email ? '' : emptyValueCls}>{form.email || '—'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — only shown in edit mode */}
            {editing && (
              <div className={`flex items-center justify-end gap-2 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
                    isDark
                      ? 'border-slate-700/70 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποθήκευση...</>
                  ) : (
                    'Αποθήκευση αλλαγών'
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}