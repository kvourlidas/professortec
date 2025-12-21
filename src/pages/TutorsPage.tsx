// src/pages/TutorsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import DatePickerField from '../components/ui/AppDatePicker';
import { Users } from 'lucide-react';



type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
  date_of_birth: string | null; // ISO: yyyy-mm-dd
  afm: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

type ModalMode = 'create' | 'edit';

type TutorFormState = {
  fullName: string;
  dateOfBirth: string; // dd/mm/yyyy (UI value for AppDatePicker)
  afm: string;
  phone: string;
  email: string;
};

const emptyForm: TutorFormState = {
  fullName: '',
  dateOfBirth: '',
  afm: '',
  phone: '',
  email: '',
};

const TUTOR_SELECT =
  'id, school_id, full_name, date_of_birth, afm, phone, email, created_at';

// helper: convert "yyyy-mm-dd" -> "dd/mm/yyyy" (for table display)
function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-'); // [yyyy, mm, dd]
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// helpers: ISO <-> display for the AppDatePicker
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`; // dd/mm/yyyy
}

function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/); // dd / mm / yyyy
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`; // yyyy-mm-dd
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

  // ✅ Pagination (same as Students/Classes)
  const pageSize = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<TutorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        .select(TUTOR_SELECT)
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

  const resetForm = () => setForm(emptyForm);

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
      dateOfBirth: row.date_of_birth ? isoToDisplay(row.date_of_birth) : '',
      afm: row.afm ?? '',
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

    // convert dd/mm/yyyy from AppDatePicker -> ISO for DB
    const isoDob = displayToIso(form.dateOfBirth);

    const payload = {
      school_id: schoolId,
      full_name: fullNameTrimmed,
      date_of_birth: isoDob || null,
      afm: form.afm.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    };

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('tutors')
        .insert(payload)
        .select(TUTOR_SELECT)
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
          phone: payload.phone,
          email: payload.email,
        })
        .eq('id', editingTutor.id)
        .eq('school_id', schoolId)
        .select(TUTOR_SELECT)
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης καθηγητή.');
        return;
      }

      setTutors((prev) =>
        prev.map((t) => (t.id === editingTutor.id ? (data as TutorRow) : t)),
      );
      closeModal();
    } else {
      setSaving(false);
    }
  };

  // open custom delete modal
  const askDeleteTutor = (row: TutorRow) => {
    setError(null);
    setDeleteTarget(row);
  };

  // confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !schoolId) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase
      .from('tutors')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('school_id', schoolId);

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής καθηγητή.');
      return;
    }

    setTutors((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  // 🔍 Filter tutors by any field (NO salaries πλέον)
  const filteredTutors = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return tutors;

    return tutors.filter((t) => {
      const composite = [
        t.full_name,
        t.afm,
        t.phone,
        t.email,
        t.date_of_birth,
        t.date_of_birth ? formatDateToGreek(t.date_of_birth) : '',
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [tutors, search]);

  // ✅ Pagination helpers
  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTutors.length / pageSize));
  }, [filteredTutors.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedTutors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTutors.slice(start, start + pageSize);
  }, [filteredTutors, page]);

  const showingFrom = filteredTutors.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredTutors.length);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-slate-50">
            <Users className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            Καθηγητές
          </h1>
          <p className="text-xs text-slate-300">Διαχείριση καθηγητών και στοιχείων επικοινωνίας.</p>
          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο καθηγητών:{' '}
              <span className="font-medium text-slate-100">{tutors.length}</span>
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

      {/* ✅ Tutors table */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-4 text-xs text-slate-300">Φόρτωση καθηγητών…</div>
          ) : tutors.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν υπάρχουν ακόμη καθηγητές. Πατήστε «Προσθήκη καθηγητή» για να δημιουργήσετε τον πρώτο.
            </div>
          ) : filteredTutors.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν βρέθηκαν καθηγητές με αυτά τα κριτήρια αναζήτησης.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Ονοματεπώνυμο</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Ημερομηνία γέννησης</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΑΦΜ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Τηλέφωνο</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Email</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {pagedTutors.map((t, idx) => {
                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg = absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={t.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-700 px-4 py-2 text-left">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-td)' }}>
                          {t.full_name}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.date_of_birth ? formatDateToGreek(t.date_of_birth) : '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.afm || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.phone || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.email || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <EditDeleteButtons
                            onEdit={() => openEditModal(t)}
                            onDelete={() => askDeleteTutor(t)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ✅ Pagination footer */}
        {!loading && filteredTutors.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredTutors.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Προηγ.
              </button>

              <div className="rounded-md border border-slate-700 bg-slate-900/20 px-3 py-1.5 text-[11px] text-slate-200">
                Σελίδα <span className="text-slate-50">{page}</span> /{' '}
                <span className="text-slate-50">{pageCount}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Επόμ.
              </button>
            </div>
          </div>
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
                {modalMode === 'create' ? 'Νέος καθηγητής' : 'Επεξεργασία καθηγητή'}
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
                <label className="form-label text-slate-100">Ονοματεπώνυμο *</label>
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

              <DatePickerField
                label="Ημερομηνία γέννησης"
                value={form.dateOfBirth}
                onChange={(value) => setForm((prev) => ({ ...prev, dateOfBirth: value }))}
                placeholder="π.χ. 24/12/1985"
                id="tutor-dob"
              />

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

              <div>
                <label className="form-label text-slate-100">Τηλέφωνο</label>
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
                <label className="form-label text-slate-100">Email</label>
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
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Αποθήκευση...' : modalMode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">Διαγραφή καθηγητή</h3>
            <p className="mb-4 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε τον καθηγητή{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                {deleteTarget.full_name}
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="btn-ghost px-3 py-1"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={deleting}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
