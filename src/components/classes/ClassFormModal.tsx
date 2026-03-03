import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, GraduationCap, BookOpen, Layers, Loader2, CheckSquare, Square } from 'lucide-react';

type ClassFormState = {
  title: string;
  levelId: string;
  subjectIds: string[];
};

const emptyForm: ClassFormState = { title: '', levelId: '', subjectIds: [] };

type SubjectOption = { id: string; name: string; level_id: string | null };
type LevelOption = { id: string; name: string };
type ClassForEdit = { id: string; title: string; subject: string | null; subject_id: string | null; tutor_id: string | null };

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
  open, mode, editingClass, subjects, levels, error, saving, onClose, onSubmit,
}: ClassFormModalProps) {
  const [form, setForm] = useState<ClassFormState>(emptyForm);

  useEffect(() => {
    if (!open) { setForm(emptyForm); return; }
    if (mode === 'edit' && editingClass) {
      setForm({ title: editingClass.title ?? '', levelId: '', subjectIds: [] });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, editingClass]);

  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeLevels = Array.isArray(levels) ? levels : [];

  const handleChangeTitle = (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, title: e.target.value }));

  const handleChangeLevel = (e: ChangeEvent<HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, levelId: e.target.value, subjectIds: [] }));

  const toggleSubject = (subjectId: string) =>
    setForm((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const subjectsForSelectedLevel = useMemo(() => {
    if (!form.levelId) return [];
    return safeSubjects.filter((s) => s.level_id === form.levelId);
  }, [safeSubjects, form.levelId]);

  if (!open) return null;

  const isCreate = mode === 'create';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl"
        style={{ background: 'var(--color-sidebar)' }}
      >
        {/* Accent bar */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}
            >
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                {isCreate ? 'Νέο τμήμα' : 'Επεξεργασία τμήματος'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isCreate ? 'Συμπληρώστε τα στοιχεία του νέου τμήματος' : `Επεξεργασία: ${editingClass?.title}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 pb-6">

            {/* Title */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <GraduationCap className="h-3 w-3" />
                Όνομα τμήματος <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input
                value={form.title}
                onChange={handleChangeTitle}
                required
                placeholder="π.χ. Τμήμα Α1"
                className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30"
              />
            </div>

            {/* Level */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Layers className="h-3 w-3" />
                Επίπεδο
              </label>
              <select
                value={form.levelId}
                onChange={handleChangeLevel}
                className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30"
              >
                <option value="">Επιλέξτε επίπεδο…</option>
                {safeLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Πρώτα επιλέξτε επίπεδο για να εμφανιστούν τα διαθέσιμα μαθήματα.
              </p>
            </div>

            {/* Subjects */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <BookOpen className="h-3 w-3" />
                Μαθήματα
                {form.subjectIds.length > 0 && (
                  <span
                    className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {form.subjectIds.length}
                  </span>
                )}
              </label>

              {form.levelId === '' ? (
                <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30">
                  <p className="text-[11px] text-slate-500">Επιλέξτε πρώτα επίπεδο</p>
                </div>
              ) : subjectsForSelectedLevel.length === 0 ? (
                <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30">
                  <p className="text-[11px] text-slate-500">Δεν υπάρχουν μαθήματα για αυτό το επίπεδο.</p>
                </div>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/40 p-2">
                  {subjectsForSelectedLevel.map((s) => {
                    const checked = form.subjectIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-slate-800/60"
                      >
                        {checked
                          ? <CheckSquare className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
                          : <Square className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        }
                        <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.id)} className="sr-only" />
                        <span className={checked ? 'text-slate-100' : 'text-slate-400'}>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-slate-500">
                Μπορείτε να επιλέξετε πολλά μαθήματα από το ίδιο επίπεδο.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60"
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {saving ? (
                <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>
              ) : isCreate ? 'Δημιουργία' : 'Αποθήκευση αλλαγών'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}