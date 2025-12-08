import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type ClassFormState = {
  title: string;
  levelId: string;
  subjectIds: string[]; // multi-select
};

const emptyForm: ClassFormState = {
  title: '',
  levelId: '',
  subjectIds: [],
};

type SubjectOption = {
  id: string;
  name: string;
  level_id: string | null;
};

type LevelOption = {
  id: string;
  name: string;
};

type ClassForEdit = {
  id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null; // ignored now
};

type ClassFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  editingClass: ClassForEdit | null;
  subjects: SubjectOption[];
  levels: LevelOption[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ClassFormState) => Promise<void> | void;
};

export default function ClassFormModal({
  open,
  mode,
  editingClass,
  subjects,
  levels,
  error,
  saving,
  onClose,
  onSubmit,
}: ClassFormModalProps) {
  const [form, setForm] = useState<ClassFormState>(emptyForm);

  // ✅ Always run this hook; it just updates form based on `open` / `mode`
  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }

    if (mode === 'edit' && editingClass) {
      // Safe: only prefill title; user re-selects level & subjects
      setForm({
        title: editingClass.title ?? '',
        levelId: '',
        subjectIds: [],
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, editingClass]);

  // ✅ These are NOT hooks, just safe fallbacks
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeLevels = Array.isArray(levels) ? levels : [];

  const handleChangeTitle = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, title: e.target.value }));
  };

  const handleChangeLevel = (e: ChangeEvent<HTMLSelectElement>) => {
    const newLevelId = e.target.value;

    setForm((prev) => ({
      ...prev,
      levelId: newLevelId,
      // όταν αλλάζει το level, καθαρίζουμε τα επιλεγμένα μαθήματα
      subjectIds: [],
    }));
  };

  const toggleSubject = (subjectId: string) => {
    setForm((prev) => {
      const exists = prev.subjectIds.includes(subjectId);
      return {
        ...prev,
        subjectIds: exists
          ? prev.subjectIds.filter((id) => id !== subjectId)
          : [...prev.subjectIds, subjectId],
      };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(form);
  };

  // ✅ useMemo must ALWAYS run, regardless of `open`
  const subjectsForSelectedLevel = useMemo(() => {
    if (!form.levelId) return [];
    return safeSubjects.filter((s) => s.level_id === form.levelId);
  }, [safeSubjects, form.levelId]);

  // ⛔ Hook section is finished. Now it's safe to conditionally return.
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-lg rounded-xl p-5 shadow-xl border border-slate-700"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50">
            {mode === 'create' ? 'Νέο τμήμα' : 'Επεξεργασία τμήματος'}
          </h2>
          <button type="button" onClick={onClose} className="text-xs">
            Κλείσιμο
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Όνομα τμήματος */}
          <div>
            <label className="form-label text-slate-100">
              Όνομα τμήματος *
            </label>
            <input
              value={form.title}
              onChange={handleChangeTitle}
              required
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              placeholder="π.χ. Τμήμα Α1"
            />
          </div>

          {/* Επίπεδο */}
          <div>
            <label className="form-label text-slate-100">Επίπεδο</label>
            <select
              value={form.levelId}
              onChange={handleChangeLevel}
              className="form-input select-accent"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
            >
              <option value="">Επιλέξτε επίπεδο</option>
              {safeLevels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              Πρώτα επιλέξτε επίπεδο για να εμφανιστούν τα διαθέσιμα μαθήματα.
            </p>
          </div>

          {/* Μαθήματα */}
          <div>
            <label className="form-label text-slate-100">
              Μαθήματα (από το ίδιο επίπεδο)
            </label>

            {form.levelId === '' ? (
              <p className="text-[11px] text-slate-400">
                Επιλέξτε πρώτα επίπεδο.
              </p>
            ) : subjectsForSelectedLevel.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Δεν υπάρχουν μαθήματα για αυτό το επίπεδο.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-700 bg-slate-900/60 p-2">
                {subjectsForSelectedLevel.map((s) => {
                  const checked = form.subjectIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800/60"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubject(s.id)}
                        className="h-3 w-3 rounded border-slate-500 bg-slate-900"
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <p className="mt-1 text-[10px] text-slate-400">
              Μπορείτε να επιλέξετε πολλά μαθήματα, αλλά όλα πρέπει να ανήκουν
              στο ίδιο επίπεδο.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
            >
              Ακύρωση
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? 'Αποθήκευση...'
                : mode === 'create'
                ? 'Δημιουργία'
                : 'Αποθήκευση αλλαγών'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
