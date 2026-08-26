// src/pages/SchoolInfoPage.tsx
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useToast } from '../context/ToastContext';
import { Building2, MapPin, Phone, Mail, Calendar, Loader2, Pencil, X } from 'lucide-react';
import type { SchoolForm, SchoolRow } from '../components/school-info/types';
import { emptyForm } from '../components/school-info/types';
import LoginCredentialsSection from '../components/school-info/LoginCredentialsSection';
import SchoolYearsSection from '../components/school-info/SchoolYearsSection';

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
  const schoolId = profile?.school_id ?? null;

  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [saved, setSaved] = useState<SchoolForm>(emptyForm);
  const [signupDate, setSignupDate] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, address, phone, email, created_at')
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
        setSignupDate(row.created_at ?? null);
      }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const handleChange = (field: keyof SchoolForm) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // ── Update via edge function ──────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    if (!form.name.trim()) { setError('Το όνομα σχολείου είναι υποχρεωτικό.'); return; }
    setSaving(true); setError(null);
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
      showToast('Οι αλλαγές αποθηκεύτηκαν με επιτυχία.');
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
    <div className="max-w-2xl space-y-10 px-1">

      {/* ── School info ── */}
      <section className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>Πληροφορίες Σχολείου</h1>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>Στοιχεία επικοινωνίας του φροντιστηρίου</p>
            {signupDate && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Calendar className="h-3.5 w-3.5 opacity-60" />
                Εγγραφή στο σύστημα: {new Date(signupDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          {!loading && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              Επεξεργασία
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* School Name */}
            <div>
              <label className="form-label">
                <Building2 className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                Επωνυμία Σχολείου
              </label>
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChange('name')}
                  placeholder="π.χ. Φροντιστήριο Αθηνά"
                  className="form-input"
                  required
                  autoFocus
                />
              ) : (
                <p className="text-sm" style={{ color: form.name ? 'var(--color-text-main)' : 'var(--color-text-faint)' }}>
                  {form.name || '—'}
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="form-label">
                <MapPin className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                Διεύθυνση
              </label>
              {editing ? (
                <input
                  type="text"
                  value={form.address}
                  onChange={handleChange('address')}
                  placeholder="π.χ. Λεωφόρος Αθηνών 42, Αθήνα 10434"
                  className="form-input"
                />
              ) : (
                <p className="text-sm" style={{ color: form.address ? 'var(--color-text-main)' : 'var(--color-text-faint)' }}>
                  {form.address || '—'}
                </p>
              )}
            </div>

            {/* Phone + Email side by side */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">
                  <Phone className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                  Τηλέφωνο
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="π.χ. 210 123 4567"
                    className="form-input"
                  />
                ) : (
                  <p className="text-sm" style={{ color: form.phone ? 'var(--color-text-main)' : 'var(--color-text-faint)' }}>
                    {form.phone || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">
                  <Mail className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                  Email
                </label>
                {editing ? (
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="π.χ. info@school.gr"
                    className="form-input"
                  />
                ) : (
                  <p className="text-sm" style={{ color: form.email ? 'var(--color-text-main)' : 'var(--color-text-faint)' }}>
                    {form.email || '—'}
                  </p>
                )}
              </div>
            </div>

            {/* Footer — only shown in edit mode */}
            {editing && (
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-60"
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
      </section>

      <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── School years ── */}
      <SchoolYearsSection />

      <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

      {/* ── Login credentials ── */}
      <LoginCredentialsSection />
    </div>
  );
}
