// src/pages/TutorsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
  date_of_birth: string | null;
  afm: string | null;
  salary_gross: number | null;
  salary_net: number | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

type ModalMode = 'create' | 'edit';

type TutorFormState = {
  fullName: string;
  dateOfBirth: string; // yyyy-mm-dd
  afm: string;
  salaryGross: string;
  salaryNet: string;
  phone: string;
  email: string;
};

const emptyForm: TutorFormState = {
  fullName: '',
  dateOfBirth: '',
  afm: '',
  salaryGross: '',
  salaryNet: '',
  phone: '',
  email: '',
};

// helper: convert "yyyy-mm-dd" -> "dd/mm/yyyy"
function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-'); // [yyyy, mm, dd]
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// helper: normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function TutorsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingTutor, setEditingTutor] = useState<TutorRow | null>(null);
  const [form, setForm] = useState<TutorFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  // Load tutors
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('tutors')
        .select(
          'id, school_id, full_name, date_of_birth, afm, salary_gross, salary_net, phone, email, created_at',
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης καθηγητών.');
      } else {
        setTutors((data ?? []) as TutorRow[]);
      }

      setLoading(false);
    };

    load();
  }, [schoolId]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setModalMode('create');
    setEditingTutor(null);
    setModalOpen(true);
  };

  const openEditModal = (row: TutorRow) => {
    setError(null);
    setModalMode('edit');
    setEditingTutor(row);

    setForm({
      fullName: row.full_name ?? '',
      dateOfBirth: row.date_of_birth ?? '',
      afm: row.afm ?? '',
      salaryGross:
        row.salary_gross != null ? String(row.salary_gross) : '',
      salaryNet:
        row.salary_net != null ? String(row.salary_net) : '',
      phone: row.phone ?? '',
      email: row.email ?? '',
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingTutor(null);
    setModalMode('create');
    resetForm();
  };

  const handleFormChange =
    (field: keyof TutorFormState) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    const fullNameTrimmed = form.fullName.trim();
    if (!fullNameTrimmed) return;

    setSaving(true);
    setError(null);

    const salaryGross =
      form.salaryGross.trim() !== '' ? Number(form.salaryGross) : null;
    const salaryNet =
      form.salaryNet.trim() !== '' ? Number(form.salaryNet) : null;

    const payload = {
      school_id: schoolId,
      full_name: fullNameTrimmed,
      date_of_birth: form.dateOfBirth || null,
      afm: form.afm.trim() || null,
      salary_gross: Number.isNaN(salaryGross) ? null : salaryGross,
      salary_net: Number.isNaN(salaryNet) ? null : salaryNet,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    };

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('tutors')
        .insert(payload)
        .select(
          'id, school_id, full_name, date_of_birth, afm, salary_gross, salary_net, phone, email, created_at',
        )
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία δημιουργίας καθηγητή.');
        return;
      }

      setTutors((prev) => [...prev, data as TutorRow]);
      closeModal();
    } else if (modalMode === 'edit' && editingTutor) {
      const { data, error } = await supabase
        .from('tutors')
        .update({
          full_name: payload.full_name,
          date_of_birth: payload.date_of_birth,
          afm: payload.afm,
          salary_gross: payload.salary_gross,
          salary_net: payload.salary_net,
          phone: payload.phone,
          email: payload.email,
        })
        .eq('id', editingTutor.id)
        .eq('school_id', schoolId)
        .select(
          'id, school_id, full_name, date_of_birth, afm, salary_gross, salary_net, phone, email, created_at',
        )
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης καθηγητή.');
        return;
      }

      setTutors((prev) =>
        prev.map((t) =>
          t.id === editingTutor.id ? (data as TutorRow) : t,
        ),
      );
      closeModal();
    } else {
      setSaving(false);
    }
  };

  const deleteTutor = async (id: string) => {
    const ok = window.confirm(
      'Σίγουρα θέλετε να διαγράψετε αυτόν τον καθηγητή;',
    );
    if (!ok) return;

    setError(null);

    const { error } = await supabase
      .from('tutors')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId ?? '');

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής καθηγητή.');
      return;
    }

    setTutors((prev) => prev.filter((t) => t.id !== id));
  };

  // 🔍 Filter tutors by any field
  const filteredTutors = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return tutors;

    return tutors.filter((t) => {
      const composite = [
        t.full_name,
        t.afm,
        t.phone,
        t.email,
        t.salary_gross,
        t.salary_net,
        t.date_of_birth,
        t.date_of_birth ? formatDateToGreek(t.date_of_birth) : '',
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [tutors, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">
            Καθηγητές
          </h1>
          <p className="text-xs text-slate-300">
            Διαχείριση καθηγητών, στοιχείων και μισθοδοσίας.
          </p>
          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο καθηγητών:{' '}
              <span className="font-medium text-slate-100">
                {tutors.length}
              </span>
              {search.trim() && (
                <>
                  {' · '}
                  <span className="text-slate-300">
                    Εμφανίζονται: {filteredTutors.length}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="form-input w-full sm:w-56"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text-main)',
            }}
            placeholder="Αναζήτηση..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary"
            style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
          >
            Προσθήκη καθηγητή
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-900/40 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!schoolId && (
        <div className="rounded border border-amber-500 bg-amber-900/40 px-4 py-2 text-xs text-amber-100">
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* Tutors table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-4 text-xs text-slate-300">
            Φόρτωση καθηγητών…
          </div>
        ) : tutors.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν υπάρχουν ακόμη καθηγητές. Πατήστε «Προσθήκη καθηγητή» για να
            δημιουργήσετε τον πρώτο.
          </div>
        ) : filteredTutors.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν βρέθηκαν καθηγητές με αυτά τα κριτήρια αναζήτησης.
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Ονοματεπώνυμο
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Ημερομηνία γέννησης
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  ΑΦΜ
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-right">
                  Μισθός μικτά
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-right">
                  Μισθός καθαρά
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Τηλέφωνο
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Email
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-right">
                  Ενέργειες
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTutors.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40">
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.full_name}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.date_of_birth
                        ? formatDateToGreek(t.date_of_birth)
                        : '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.afm || '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-right">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.salary_gross != null ? t.salary_gross.toFixed(2) : '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-right">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.salary_net != null ? t.salary_net.toFixed(2) : '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.phone || '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {t.email || '—'}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="btn-ghost px-2 py-1 text-[11px]"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        Επεξεργασία
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTutor(t.id)}
                        className="btn-primary bg-red-600 px-2 py-1 text-[11px] hover:bg-red-700"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: create / edit tutor */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                {modalMode === 'create'
                  ? 'Νέος καθηγητής'
                  : 'Επεξεργασία καθηγητή'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded bg-red-900/60 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="form-label text-slate-100">
                  Ονοματεπώνυμο *
                </label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Γιάννης Παπαδόπουλος"
                  value={form.fullName}
                  onChange={handleFormChange('fullName')}
                  required
                />
              </div>

              <div>
                <label className="form-label text-slate-100">
                  Ημερομηνία γέννησης
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  value={form.dateOfBirth}
                  onChange={handleFormChange('dateOfBirth')}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">ΑΦΜ</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. 123456789"
                  value={form.afm}
                  onChange={handleFormChange('afm')}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Μισθός μικτά
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                    placeholder="π.χ. 1200.00"
                    value={form.salaryGross}
                    onChange={handleFormChange('salaryGross')}
                  />
                </div>
                <div>
                  <label className="form-label text-slate-100">
                    Μισθός καθαρά
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                    placeholder="π.χ. 900.00"
                    value={form.salaryNet}
                    onChange={handleFormChange('salaryNet')}
                  />
                </div>
              </div>

              <div>
                <label className="form-label text-slate-100">
                  Τηλέφωνο
                </label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. 6900000000"
                  value={form.phone}
                  onChange={handleFormChange('phone')}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">
                  Email
                </label>
                <input
                  type="email"
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. tutor@example.com"
                  value={form.email}
                  onChange={handleFormChange('email')}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  disabled={saving}
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Αποθήκευση...'
                    : modalMode === 'create'
                    ? 'Αποθήκευση'
                    : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
