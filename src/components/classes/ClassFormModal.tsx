import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type ClassFormState = {
  title: string;
  subject: string;
  levelId: string;
  tutorId: string;
};

const emptyForm: ClassFormState = {
  title: '',
  subject: '',
  levelId: '',
  tutorId: '',
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

type TutorOption = {
  id: string;
  full_name: string;
};

type ClassForEdit = {
  id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

type ClassFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  editingClass: ClassForEdit | null;
  subjects: SubjectOption[];
  levels: LevelOption[];
  tutors: TutorOption[];
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
  tutors,
  error,
  saving,
  onClose,
  onSubmit,
}: ClassFormModalProps) {
  const [form, setForm] = useState<ClassFormState>(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }

    if (mode === 'edit' && editingClass) {
      const subjRow = editingClass.subject_id
        ? subjects.find((s) => s.id === editingClass.subject_id)
        : undefined;

      setForm({
        title: editingClass.title ?? '',
        subject: subjRow?.name ?? editingClass.subject ?? '',
        levelId: subjRow?.level_id ?? '',
        tutorId: editingClass.tutor_id ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, editingClass, subjects]);

  const handleFormChange =
    (field: keyof ClassFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        if (field === 'subject') {
          // reset level when subject changes
          return { ...prev, subject: value, levelId: '' };
        }
        return { ...prev, [field]: value };
      });
    };

  const subjectNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    subjects.forEach((s) => {
      if (s.name && !seen.has(s.name)) {
        seen.add(s.name);
        list.push(s.name);
      }
    });
    return list;
  }, [subjects]);

  const levelsForSelectedSubject = useMemo(() => {
    if (!form.subject) return [];
    const levelIds = new Set(
      subjects
        .filter((s) => s.name === form.subject && s.level_id)
        .map((s) => s.level_id as string),
    );
    return levels.filter((lvl) => levelIds.has(lvl.id));
  }, [form.subject, subjects, levels]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(form);
  };

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
          <div>
            <label className="form-label text-slate-100">
              Όνομα τμήματος *
            </label>
            <input
              value={form.title}
              onChange={handleFormChange('title')}
              required
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              placeholder="π.χ. Τμήμα Α1"
            />
          </div>

          {/* Μάθημα + Επίπεδο */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="form-label text-slate-100">Μάθημα</label>
              <select
                value={form.subject}
                onChange={handleFormChange('subject')}
                className="form-input select-accent"
              >
                <option value="">Επιλέξτε μάθημα</option>
                {subjectNameOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label text-slate-100">Επίπεδο</label>
              <select
                value={form.levelId}
                onChange={handleFormChange('levelId')}
                className="form-input select-accent"
                disabled={
                  !form.subject || levelsForSelectedSubject.length === 0
                }
              >
                <option value="">
                  {form.subject
                    ? 'Επιλέξτε επίπεδο'
                    : 'Επιλέξτε πρώτα μάθημα'}
                </option>
                {levelsForSelectedSubject.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Καθηγητής */}
          <div>
            <label className="form-label text-slate-100">Καθηγητής</label>
            <select
              value={form.tutorId}
              onChange={handleFormChange('tutorId')}
              className="form-input select-accent"
            >
              <option value="">Επιλέξτε καθηγητή</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

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
