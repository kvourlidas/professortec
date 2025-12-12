// src/pages/StudentsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import DatePickerField from '../components/ui/AppDatePicker';

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  school_id: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  level_id: string | null;
  father_name: string | null;
  mother_name: string | null;
  created_at: string;
};

// helper: convert "yyyy-mm-dd" -> "dd/mm/yyyy" (for table display)
function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-'); // [yyyy, mm, dd]
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// helpers for AppDatePicker (dd/mm/yyyy) <-> ISO (yyyy-mm-dd)
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/); // dd / mm / yyyy
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// helper: normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type ModalMode = 'create' | 'edit';

export default function StudentsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);

  // 🔴 delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [fullName, setFullName] = useState('');
  // holds dd/mm/yyyy for the AppDatePicker
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [levelId, setLevelId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');

  const [search, setSearch] = useState('');

  // Pagination (10 per page)
  const pageSize = 10;
  const [page, setPage] = useState(1);

  // reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Map level_id -> level name for fast lookup
  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  // Load levels for dropdown
  useEffect(() => {
    if (!schoolId) return;

    const loadLevels = async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης επιπέδων.');
      } else {
        setLevels((data ?? []) as LevelRow[]);
      }
    };

    loadLevels();
  }, [schoolId]);

  // Load students
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('students')
        .select(
          'id, school_id, full_name, date_of_birth, phone, email, level_id, father_name, mother_name, created_at',
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης μαθητών.');
      } else {
        setStudents((data ?? []) as StudentRow[]);
      }
      setLoading(false);
    };

    load();
  }, [schoolId]);

  const resetForm = () => {
    setFullName('');
    setDateOfBirth('');
    setPhone('');
    setEmail('');
    setLevelId('');
    setFatherName('');
    setMotherName('');
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setModalMode('create');
    setEditingStudent(null);
    setModalOpen(true);
  };

  const openEditModal = (student: StudentRow) => {
    setError(null);
    setModalMode('edit');
    setEditingStudent(student);

    setFullName(student.full_name ?? '');
    // convert ISO from DB -> dd/mm/yyyy for picker
    setDateOfBirth(student.date_of_birth ? isoToDisplay(student.date_of_birth) : '');
    setPhone(student.phone ?? '');
    setEmail(student.email ?? '');
    setLevelId(student.level_id ?? '');
    setFatherName(student.father_name ?? '');
    setMotherName(student.mother_name ?? '');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingStudent(null);
    setModalMode('create');
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) return;

    setSaving(true);
    setError(null);

    // convert dd/mm/yyyy -> ISO for DB
    const isoDob = displayToIso(dateOfBirth);

    const payload = {
      school_id: schoolId,
      full_name: nameTrimmed,
      date_of_birth: isoDob || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      level_id: levelId || null,
      father_name: fatherName.trim() || null,
      mother_name: motherName.trim() || null,
    };

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('students')
        .insert(payload)
        .select(
          'id, school_id, full_name, date_of_birth, phone, email, level_id, father_name, mother_name, created_at',
        )
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία δημιουργίας μαθητή.');
        return;
      }

      setStudents((prev) => [...prev, data as StudentRow]);
      closeModal();
    } else if (modalMode === 'edit' && editingStudent) {
      const { data, error } = await supabase
        .from('students')
        .update({
          full_name: payload.full_name,
          date_of_birth: payload.date_of_birth,
          phone: payload.phone,
          email: payload.email,
          level_id: payload.level_id,
          father_name: payload.father_name,
          mother_name: payload.mother_name,
        })
        .eq('id', editingStudent.id)
        .eq('school_id', schoolId)
        .select(
          'id, school_id, full_name, date_of_birth, phone, email, level_id, father_name, mother_name, created_at',
        )
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης μαθητή.');
        return;
      }

      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? (data as StudentRow) : s)),
      );
      closeModal();
    } else {
      setSaving(false);
    }
  };

  // 🔴 open delete-confirm modal instead of window.confirm
  const askDeleteStudent = (student: StudentRow) => {
    setError(null);
    setDeleteTarget(student);
  };

  const cancelDeleteStudent = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDeleteStudent = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('school_id', schoolId ?? '');

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής μαθητή.');
      return;
    }

    setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // 🔍 Filter students by any field
  const filteredStudents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return students;

    return students.filter((s) => {
      const levelName =
        s.level_id && levelNameById.get(s.level_id) ? levelNameById.get(s.level_id)! : '';

      const composite = [
        s.full_name,
        s.father_name,
        s.mother_name,
        levelName,
        s.phone,
        s.email,
        s.date_of_birth,
        s.date_of_birth ? formatDateToGreek(s.date_of_birth) : '',
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [students, levelNameById, search]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  }, [filteredStudents.length]);

  // clamp page if items change (delete/filter)
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page]);

  const showingFrom = filteredStudents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredStudents.length);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">Μαθητές</h1>
          <p className="text-xs text-slate-300">Διαχείριση μαθητών του σχολείου σας.</p>
          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο μαθητών:{' '}
              <span className="font-medium text-slate-100">{students.length}</span>
              {search.trim() && (
                <>
                  {' · '}
                  <span className="text-slate-300">Εμφανίζονται: {filteredStudents.length}</span>
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
            Προσθήκη μαθητή
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

      {/* Students table in glass card + pagination */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-4 text-xs text-slate-300">Φόρτωση μαθητών…</div>
          ) : students.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν υπάρχουν ακόμη μαθητές. Πατήστε «Προσθήκη μαθητή» για να δημιουργήσετε τον πρώτο.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν βρέθηκαν μαθητές με αυτά τα κριτήρια αναζήτησης.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Ονοματεπώνυμο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Όνομα πατέρα</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Όνομα μητέρας</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Επίπεδο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">
                    Ημερομηνία γέννησης
                  </th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Τηλέφωνο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Email</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-right">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {pagedStudents.map((s, idx) => {
                  const levelName =
                    s.level_id && levelNameById.get(s.level_id)
                      ? levelNameById.get(s.level_id)
                      : '—';

                  // keep striping consistent across pages
                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg = absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={s.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span
                          className="text-xs font-medium"
                          style={{ color: 'var(--color-text-td)' }}
                        >
                          {s.full_name}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.father_name || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.mother_name || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {levelName}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.date_of_birth ? formatDateToGreek(s.date_of_birth) : '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.phone || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.email || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <EditDeleteButtons
                            onEdit={() => openEditModal(s)}
                            onDelete={() => askDeleteStudent(s)}
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

        {/* Pagination footer */}
        {!loading && filteredStudents.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredStudents.length}</span>
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

      {/* Modal: create / edit student */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                {modalMode === 'create' ? 'Νέος μαθητής' : 'Επεξεργασία μαθητή'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

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
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Όνομα πατέρα</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Δημήτρης Παπαδόπουλος"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Όνομα μητέρας</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Μαρία Παπαδοπούλου"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Επίπεδο</label>
                <select
                  className="form-input select-accent"
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                >
                  <option value="">Χωρίς επίπεδο</option>
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ημερομηνία γέννησης with AppDatePicker */}
              <DatePickerField
                label="Ημερομηνία γέννησης"
                value={dateOfBirth} // dd/mm/yyyy
                onChange={setDateOfBirth}
                placeholder="π.χ. 24/12/2010"
                id="student-dob"
              />

              <div>
                <label className="form-label text-slate-100">Τηλέφωνο</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. 6900000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  placeholder="π.χ. student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

      {/* 🔴 Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h2 className="text-sm font-semibold text-slate-50">Διαγραφή μαθητή</h2>
            <p className="mt-3 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε τον μαθητή{' '}
              <span className="font-semibold text-[var(--color-accent)]">
                «{deleteTarget.full_name}»
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
            </p>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={cancelDeleteStudent}
                className="btn-ghost"
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
                onClick={confirmDeleteStudent}
                className="btn-primary"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
                disabled={deleting}
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
