import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { Pencil, Trash2, Plus } from 'lucide-react';
import SubjectTutorsModal from '../components/subjects/SubjectTutorsModal';

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
};

type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  level_id: string | null;
  created_at: string;
};

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

type ModalMode = 'create' | 'edit';

// helper: normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function SubjectsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [subjectName, setSubjectName] = useState('');
  const [levelId, setLevelId] = useState('');

  const [search, setSearch] = useState('');

  // delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ⭐ modal για καθηγητές ανά μάθημα
  const [tutorsModalSubject, setTutorsModalSubject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ⭐ tutors per subject
  const [tutorsBySubject, setTutorsBySubject] = useState<
    Map<string, TutorRow[]>
  >(new Map());

  // flag για reload μετά από αλλαγές στο modal
  const [reloadSubjectTutorsFlag, setReloadSubjectTutorsFlag] = useState(0);

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

  // Load subjects
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('subjects')
        .select('id, school_id, name, level_id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης μαθημάτων.');
      } else {
        setSubjects((data ?? []) as SubjectRow[]);
      }

      setLoading(false);
    };

    load();
  }, [schoolId]);

  // ⭐ Load tutors per subject
  useEffect(() => {
    if (!schoolId) return;

    const loadSubjectTutors = async () => {
      try {
        const [{ data: tutorsData, error: tutorsErr }, { data: linksData, error: linksErr }] =
          await Promise.all([
            supabase
              .from('tutors')
              .select('id, school_id, full_name')
              .eq('school_id', schoolId)
              .order('full_name', { ascending: true }),
            supabase
              .from('subject_tutors')
              .select('subject_id, tutor_id')
              .eq('school_id', schoolId),
          ]);

        if (tutorsErr) throw tutorsErr;
        if (linksErr) throw linksErr;

        const tutors = (tutorsData ?? []) as TutorRow[];
        type LinkRow = { subject_id: string; tutor_id: string };
        const links = (linksData ?? []) as LinkRow[];

        const map = new Map<string, TutorRow[]>();

        links.forEach((link) => {
          const tutor = tutors.find((t) => t.id === link.tutor_id);
          if (!tutor) return;
          const list = map.get(link.subject_id) ?? [];
          list.push(tutor);
          map.set(link.subject_id, list);
        });

        setTutorsBySubject(map);
      } catch (err) {
        console.error('Error loading subject tutors map', err);
        // δεν σπάμε τη σελίδα, απλά δεν δείχνουμε ονόματα αν αποτύχει
      }
    };

    loadSubjectTutors();
  }, [schoolId, reloadSubjectTutorsFlag]);

  const resetForm = () => {
    setSubjectName('');
    setLevelId('');
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setModalMode('create');
    setEditingSubject(null);
    setModalOpen(true);
  };

  const openEditModal = (row: SubjectRow) => {
    setError(null);
    setModalMode('edit');
    setEditingSubject(row);
    setSubjectName(row.name ?? '');
    setLevelId(row.level_id ?? '');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingSubject(null);
    setModalMode('create');
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    const nameTrimmed = subjectName.trim();
    if (!nameTrimmed) return;
    if (!levelId) {
      setError('Παρακαλώ επιλέξτε επίπεδο.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      school_id: schoolId,
      name: nameTrimmed,
      level_id: levelId,
    };

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('subjects')
        .insert(payload)
        .select('id, school_id, name, level_id, created_at')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία δημιουργίας μαθήματος.');
        return;
      }

      setSubjects((prev) => [...prev, data as SubjectRow]);
      closeModal();
    } else if (modalMode === 'edit' && editingSubject) {
      const { data, error } = await supabase
        .from('subjects')
        .update({
          name: payload.name,
          level_id: payload.level_id,
        })
        .eq('id', editingSubject.id)
        .eq('school_id', schoolId)
        .select('id, school_id, name, level_id, created_at')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης μαθήματος.');
        return;
      }

      setSubjects((prev) =>
        prev.map((s) => (s.id === editingSubject.id ? (data as SubjectRow) : s)),
      );
      closeModal();
    } else {
      setSaving(false);
    }
  };

  const askDeleteSubject = (row: SubjectRow) => {
    setError(null);
    setDeleteTarget(row);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('school_id', schoolId ?? '');

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής μαθήματος.');
      return;
    }

    setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  // 🔍 Filter subjects by name + level name
  const filteredSubjects = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return subjects;

    return subjects.filter((subj) => {
      const levelName =
        subj.level_id && levelNameById.get(subj.level_id)
          ? levelNameById.get(subj.level_id)!
          : '';

      const composite = [subj.name, levelName].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [subjects, levelNameById, search]);

  // όταν αποθηκεύονται αλλαγές στο SubjectTutorsModal
  const handleSubjectTutorsChanged = () => {
    setReloadSubjectTutorsFlag((x) => x + 1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">
            Μαθήματα
          </h1>
          <p className="text-xs text-slate-300">
            Διαχείριση μαθημάτων και των επιπέδων τους.
          </p>
          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο μαθημάτων:{' '}
              <span className="font-medium text-slate-100">
                {subjects.length}
              </span>
              {search.trim() && (
                <>
                  {' · '}
                  <span className="text-slate-300">
                    Εμφανίζονται: {filteredSubjects.length}
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
            Προσθήκη μαθήματος
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

      {/* Subjects table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-4 text-xs text-slate-300">Φόρτωση μαθημάτων…</div>
        ) : subjects.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν υπάρχουν ακόμη μαθήματα. Πατήστε «Προσθήκη μαθήματος» για να
            δημιουργήσετε το πρώτο.
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν βρέθηκαν μαθήματα με αυτά τα κριτήρια αναζήτησης.
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Όνομα μαθήματος
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Επίπεδο
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Καθηγητές
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-right">
                  Ενέργειες
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((subj) => {
                const levelName =
                  subj.level_id && levelNameById.get(subj.level_id)
                    ? levelNameById.get(subj.level_id)!
                    : '—';

                const tutorList = tutorsBySubject.get(subj.id) ?? [];

                return (
                  <tr key={subj.id} className="hover:bg-slate-800/40">
                    <td className="border-b border-slate-700 px-4 py-2 text-left">
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {subj.name}
                      </span>
                    </td>
                    <td className="border-b border-slate-700 px-4 py-2 text-left">
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-text-td)' }}
                      >
                        {levelName}
                      </span>
                    </td>

                    {/* ⭐ Tutors column – icon left, names as chips */}
                    <td className="border-b border-slate-700 px-4 py-2 text-left">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setTutorsModalSubject({
                              id: subj.id,
                              name: subj.name,
                            })
                          }
                          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Plus size={13} />
                        </button>

                        <div className="flex flex-wrap gap-1">
                          {tutorList.length === 0 ? (
                            <span className="text-[11px] italic text-slate-500">
                              Χωρίς καθηγητές
                            </span>
                          ) : (
                            <>
                              {tutorList.slice(0, 3).map((t) => (
                                <span
                                  key={t.id}
                                  className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-100"
                                >
                                  {t.full_name ?? 'Χωρίς όνομα'}
                                </span>
                              ))}
                              {tutorList.length > 3 && (
                                <span className="text-[11px] text-slate-400">
                                  +{tutorList.length - 3} ακόμα
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="border-b border-slate-700 px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditModal(subj)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-blue-600/10"
                          style={{
                            borderColor: '#60a5ff',
                            color: '#60a5ff',
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => askDeleteSubject(subj)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-red-600/10"
                          style={{
                            borderColor: '#f97373',
                            color: '#f97373',
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: create / edit subject */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                {modalMode === 'create'
                  ? 'Νέο μάθημα'
                  : 'Επεξεργασία μαθήματος'}
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
                <label className="form-label text-slate-100">
                  Όνομα μαθήματος *
                </label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Αγγλικά"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label text-slate-100">
                  Επίπεδο *
                </label>
                <select
                  className="form-input select-accent"
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                  required
                >
                  <option value="">Επιλέξτε επίπεδο</option>
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">
              Διαγραφή μαθήματος
            </h3>
            <p className="mb-4 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε το μάθημα{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                «{deleteTarget.name}»
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

      {/* Modal για καθηγητές ανά μάθημα */}
      <SubjectTutorsModal
        open={!!tutorsModalSubject}
        onClose={() => setTutorsModalSubject(null)}
        subjectId={tutorsModalSubject?.id ?? null}
        subjectName={tutorsModalSubject?.name ?? ''}
        onChanged={handleSubjectTutorsChanged}
      />
    </div>
  );
}
