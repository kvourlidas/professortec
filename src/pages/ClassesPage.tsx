import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import ClassFormModal from '../components/classes/ClassFormModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import { Plus } from 'lucide-react'; // ⭐ NEW
import ClassStudentsModal from '../components/classes/ClassStudentsModal'; // ⭐ NEW

type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
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

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
};

type ModalMode = 'create' | 'edit';

type ClassFormState = {
  title: string;
  subject: string;
  levelId: string;
  tutorId: string;
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
  const [tutors, setTutors] = useState<TutorRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  // 🔴 delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ⭐ NEW – state για modal μαθητών
  const [studentsModalClass, setStudentsModalClass] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  const tutorNameById = useMemo(() => {
    const m = new Map<string, string>();
    tutors.forEach((t) => m.set(t.id, t.full_name));
    return m;
  }, [tutors]);

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
          { data: tutorData, error: tutorErr },
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
          supabase
            .from('tutors')
            .select('id, school_id, full_name')
            .eq('school_id', schoolId)
            .order('full_name', { ascending: true }),
        ]);

        if (subjErr) console.error(subjErr);
        if (lvlErr) console.error(lvlErr);
        if (tutorErr) console.error(tutorErr);

        if (subjData) setSubjects(subjData as SubjectRow[]);
        if (levelData) setLevels(levelData as LevelRow[]);
        if (tutorData) setTutors(tutorData as TutorRow[]);
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

    // Βρίσκουμε το subject row με βάση subject name + levelId
    let subjectId: string | null = null;
    if (form.subject) {
      const matchingByName = subjects.filter(
        (s) => s.name === form.subject,
      );
      if (form.levelId) {
        const match = matchingByName.find(
          (s) => s.level_id === form.levelId,
        );
        subjectId = match?.id ?? null;
      } else if (matchingByName.length === 1) {
        subjectId = matchingByName[0].id;
      }
    }

    const tutorId = form.tutorId || null;

    const payload = {
      school_id: schoolId,
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      subject_id: subjectId,
      tutor_id: tutorId,
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
          tutor_id: payload.tutor_id,
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
        prev.map((c) =>
          c.id === editingClass.id ? (data as ClassRow) : c,
        ),
      );
      closeModal();
    }
  };

  // ✅ handle actual deletion after user confirms in custom modal
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

      const tutorName = c.tutor_id
        ? tutorNameById.get(c.tutor_id) ?? ''
        : '';

      const composite = [
        c.title,
        c.subject,
        levelName,
        tutorName,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [classes, search, subjects, levelNameById, tutorNameById]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">ΤΜΗΜΑΤΑ</h1>
          <p className="text-xs text-slate-300">
            Διαχείριση τμημάτων με μάθημα, επίπεδο και καθηγητή.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Σύνολο τμημάτων:{' '}
            <span className="font-medium text-slate-100">
              {classes.length}
            </span>
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
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι
          null).
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-6 text-sm text-slate-200">Φόρτωση τμημάτων…</div>
        ) : classes.length === 0 ? (
          <div className="py-6 text-sm text-slate-200">
            Δεν υπάρχουν ακόμη τμήματα. Πατήστε «Προσθήκη τμήματος» για να
            δημιουργήσετε το πρώτο.
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-6 text-sm text-slate-200">
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
                <th className="border-b border-slate-600 px-4 py-2">
                  ΟΝΟΜΑ ΤΜΗΜΑΤΟΣ
                </th>
                <th className="border-b border-slate-600 px-4 py-2">
                  ΜΑΘΗΜΑ
                </th>
                <th className="border-b border-slate-600 px-4 py-2">
                  ΕΠΙΠΕΔΟ
                </th>
                <th className="border-b border-slate-600 px-4 py-2">
                  ΚΑΘΗΓΗΤΗΣ
                </th>
                {/* ⭐ NEW column header */}
                <th className="border-b border-slate-600 px-4 py-2">
                  ΜΑΘΗΤΕΣ
                </th>
                <th className="border-b border-slate-600 px-4 py-2 th-right">
                  ΕΝΕΡΓΕΙΕΣ
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((c) => {
                let levelName = '—';
                if (c.subject_id) {
                  const subjRow = subjects.find((s) => s.id === c.subject_id);
                  if (subjRow?.level_id) {
                    levelName =
                      levelNameById.get(subjRow.level_id) ?? '—';
                  }
                }

                const tutorName = c.tutor_id
                  ? tutorNameById.get(c.tutor_id) ?? '—'
                  : '—';

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <span
                        className="text-xs font-medium text-slate-50"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {c.title}
                      </span>
                    </td>

                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <span
                        className="text-xs text-slate-100"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {c.subject || '—'}
                      </span>
                    </td>

                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <span
                        className="text-xs text-slate-100"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {levelName}
                      </span>
                    </td>

                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <span
                        className="text-xs text-slate-100"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {tutorName}
                      </span>
                    </td>

                    {/* ⭐ NEW cell with green + button */}
                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setStudentsModalClass({ id: c.id, title: c.title })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <Plus size={14} />
                      </button>
                    </td>

                    <td className="border-b border-slate-700 px-4 py-2 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <EditDeleteButtons
                          onEdit={() => openEditModal(c)}
                          onDelete={() =>
                            setDeleteTarget({ id: c.id, title: c.title })
                          }
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

      {/* Modal for create/edit */}
      <ClassFormModal
        open={modalOpen}
        mode={modalMode}
        editingClass={editingClass}
        subjects={subjects}
        levels={levels}
        tutors={tutors}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSaveClass}
      />

      {/* ⭐ NEW: modal για μαθητές */}
      <ClassStudentsModal
        open={!!studentsModalClass}
        onClose={() => setStudentsModalClass(null)}
        classId={studentsModalClass?.id ?? null}
        classTitle={studentsModalClass?.title}
      />

      {/* 🔴 Custom delete confirmation modal – buttons aligned right */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            {/* X close */}
            <button
              type="button"
              onClick={handleCancelDelete}
              className="absolute right-4 top-3 text-slate-400 hover:text-slate-200 text-sm"
              aria-label="Κλείσιμο"
            >
              ×
            </button>

            <h3 className="mb-2 text-sm font-semibold text-slate-50">
              Διαγραφή τμήματος
            </h3>
            <p className="text-xs text-slate-200">
              Σίγουρα θέλεις να διαγράψεις το τμήμα{' '}
              <span
                className="font-semibold"
                style={{ color: 'var(--color-accent)' }}
              >
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
