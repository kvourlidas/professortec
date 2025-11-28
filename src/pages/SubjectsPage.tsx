// src/pages/SubjectsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

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

  // Map level_id -> name for quick lookup
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
      // INSERT
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
      // UPDATE
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

  const deleteSubject = async (id: string) => {
    const ok = window.confirm('Σίγουρα θέλετε να διαγράψετε αυτό το μάθημα;');
    if (!ok) return;

    setError(null);

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId ?? '');

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής μαθήματος.');
      return;
    }

    setSubjects((prev) => prev.filter((s) => s.id !== id));
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
                    <td className="border-b border-slate-700 px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(subj)}
                          className="btn-ghost px-2 py-1 text-[11px]"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          Επεξεργασία
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(subj.id)}
                          className="btn-primary bg-red-600 px-2 py-1 text-[11px] hover:bg-red-700"
                        >
                          Διαγραφή
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
    </div>
  );
}
