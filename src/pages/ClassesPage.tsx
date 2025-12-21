import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import ClassFormModal from '../components/classes/ClassFormModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import { Plus, TrendingUp } from 'lucide-react';
import ClassStudentsModal from '../components/classes/ClassStudentsModal';


type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null; // still exists in DB but not used in UI
};

type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  level_id: string | null;
};

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
};

type ModalMode = 'create' | 'edit';

type ClassFormState = {
  title: string;
  levelId: string;
  subjectIds: string[]; // multiple subjects from one level
};

// normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function ClassesPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  // ✅ Pagination (same as StudentsPage)
  const pageSize = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // modal μαθητών
  const [studentsModalClass, setStudentsModalClass] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const loadClasses = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('classes')
        .select('id, school_id, title, subject, subject_id, tutor_id')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης τμημάτων.');
      } else {
        setClasses((data ?? []) as ClassRow[]);
      }

      setLoading(false);
    };

    const loadLookups = async () => {
      try {
        const [
          { data: subjData, error: subjErr },
          { data: levelData, error: lvlErr },
        ] = await Promise.all([
          supabase
            .from('subjects')
            .select('id, school_id, name, level_id')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
          supabase
            .from('levels')
            .select('id, school_id, name')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
        ]);

        if (subjErr) console.error(subjErr);
        if (lvlErr) console.error(lvlErr);

        if (subjData) setSubjects(subjData as SubjectRow[]);
        if (levelData) setLevels(levelData as LevelRow[]);
      } catch (err) {
        console.error('Lookup load error', err);
      }
    };

    loadClasses();
    loadLookups();
  }, [schoolId]);

  const openCreateModal = () => {
    setError(null);
    setModalMode('create');
    setEditingClass(null);
    setModalOpen(true);
  };

  const openEditModal = (row: ClassRow) => {
    setError(null);
    setModalMode('edit');
    setEditingClass(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingClass(null);
    setSaving(false);
  };

  const handleSaveClass = async (form: ClassFormState) => {
    setError(null);

    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id).');
      return;
    }

    if (!form.title.trim()) {
      setError('Το όνομα του τμήματος είναι υποχρεωτικό.');
      return;
    }

    if (!form.levelId) {
      setError('Πρέπει να επιλέξετε επίπεδο.');
      return;
    }

    if (!form.subjectIds || form.subjectIds.length === 0) {
      setError('Πρέπει να επιλέξετε τουλάχιστον ένα μάθημα για το τμήμα.');
      return;
    }

    // ensure all subjects belong to selected level
    const invalidSubject = form.subjectIds.some((id) => {
      const subj = subjects.find((s) => s.id === id);
      return !subj || subj.level_id !== form.levelId;
    });

    if (invalidSubject) {
      setError('Όλα τα μαθήματα πρέπει να ανήκουν στο ίδιο επίπεδο.');
      return;
    }

    // display text: "Maths, Physics"
    const selectedSubjectRows = subjects.filter((s) =>
      form.subjectIds.includes(s.id),
    );
    const subjectText =
      selectedSubjectRows.map((s) => s.name).join(', ') || null;

    // primary subject_id = first selected
    const primarySubjectId = form.subjectIds[0] ?? null;

    const payload = {
      school_id: schoolId,
      title: form.title.trim(),
      subject: subjectText,
      subject_id: primarySubjectId,
    };

    setSaving(true);

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('classes')
        .insert(payload)
        .select('*')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία δημιουργίας τμήματος.');
        return;
      }

      setClasses((prev) => [data as ClassRow, ...prev]);
      closeModal();
    } else {
      if (!editingClass) {
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from('classes')
        .update({
          title: payload.title,
          subject: payload.subject,
          subject_id: payload.subject_id,
        })
        .eq('id', editingClass.id)
        .select('*')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης τμήματος.');
        return;
      }

      setClasses((prev) =>
        prev.map((c) => (c.id === editingClass.id ? (data as ClassRow) : c)),
      );
      closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setError(null);
    setDeleting(true);

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', deleteTarget.id);

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής τμήματος.');
      return;
    }

    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const filteredClasses = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return classes;

    return classes.filter((c) => {
      let levelName = '';
      if (c.subject_id) {
        const subjRow = subjects.find((s) => s.id === c.subject_id);
        if (subjRow?.level_id) {
          levelName = levelNameById.get(subjRow.level_id) ?? '';
        }
      }

      const composite = [c.title, c.subject, levelName].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [classes, search, subjects, levelNameById]);

  // ✅ Pagination helpers (same as StudentsPage)
  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredClasses.length / pageSize));
  }, [filteredClasses.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedClasses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClasses.slice(start, start + pageSize);
  }, [filteredClasses, page]);

  const showingFrom = filteredClasses.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredClasses.length);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-slate-50">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            Τμήματα
          </h1>
          <p className="text-xs text-slate-300">
            Διαχείριση τμημάτων με μάθημα και επίπεδο.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Σύνολο τμημάτων:{' '}
            <span className="font-medium text-slate-100">{classes.length}</span>
            {search.trim() && (
              <>
                {' · '}
                <span className="text-slate-300">
                  Εμφανίζονται: {filteredClasses.length}
                </span>
              </>
            )}
          </p>
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
            className="btn-primary text-black"
            style={{
              backgroundColor: 'var(--color-accent)',
            }}
          >
            Προσθήκη Τμήματος
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

      {/* ✅ TABLE (same styling as StudentsPage) */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-200">Φόρτωση τμημάτων…</div>
          ) : classes.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-200">
              Δεν υπάρχουν ακόμη τμήματα. Πατήστε «Προσθήκη τμήματος» για να δημιουργήσετε το πρώτο.
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-200">
              Δεν βρέθηκαν τμήματα με αυτά τα κριτήρια αναζήτησης.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs classes-table">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wide"
                  style={{
                    color: 'var(--color-text-main)',
                    fontFamily:
                      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  <th className="border-b border-slate-600 px-4 py-2">ΟΝΟΜΑ ΤΜΗΜΑΤΟΣ</th>
                  <th className="border-b border-slate-600 px-4 py-2">ΜΑΘΗΜΑ</th>
                  <th className="border-b border-slate-600 px-4 py-2">ΕΠΙΠΕΔΟ</th>
                  <th className="border-b border-slate-600 px-4 py-2">ΜΑΘΗΤΕΣ</th>
                  <th className="border-b border-slate-600 px-4 py-2 th-right">ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>

              <tbody>
                {pagedClasses.map((c, idx) => {
                  let levelName = '—';
                  if (c.subject_id) {
                    const subjRow = subjects.find((s) => s.id === c.subject_id);
                    if (subjRow?.level_id) {
                      levelName = levelNameById.get(subjRow.level_id) ?? '—';
                    }
                  }

                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg = absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={c.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-700 px-4 py-2 align-top">
                        <span
                          className="text-xs font-medium text-slate-50"
                          style={{ color: 'var(--color-text-td)' }}
                        >
                          {c.title}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-top">
                        <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                          {c.subject || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-top">
                        <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                          {levelName}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setStudentsModalClass({ id: c.id, title: c.title })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Plus size={14} />
                        </button>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <EditDeleteButtons
                            onEdit={() => openEditModal(c)}
                            onDelete={() => setDeleteTarget({ id: c.id, title: c.title })}
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

        {/* ✅ Pagination footer (same as StudentsPage) */}
        {!loading && filteredClasses.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredClasses.length}</span>
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

      {/* Modal for create/edit */}
      <ClassFormModal
        open={modalOpen}
        mode={modalMode}
        editingClass={editingClass}
        subjects={subjects}
        levels={levels}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSaveClass}
      />

      {/* Modal μαθητών */}
      <ClassStudentsModal
        open={!!studentsModalClass}
        onClose={() => setStudentsModalClass(null)}
        classId={studentsModalClass?.id ?? null}
        classTitle={studentsModalClass?.title}
      />

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <button
              type="button"
              onClick={handleCancelDelete}
              className="absolute right-4 top-3 text-slate-400 hover:text-slate-200 text-sm"
              aria-label="Κλείσιμο"
            >
              ×
            </button>

            <h3 className="mb-2 text-sm font-semibold text-slate-50">Διαγραφή τμήματος</h3>
            <p className="text-xs text-slate-200">
              Σίγουρα θέλεις να διαγράψεις το τμήμα{' '}
              <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                «{deleteTarget.title}»
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-1.5 rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] text-xs font-medium text-slate-100 hover:bg-slate-700/80"
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-xs font-semibold text-white disabled:opacity-60"
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
