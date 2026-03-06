import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, GraduationCap, BookOpen, Layers, Loader2, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

type ClassFormState = { title: string; levelId: string; subjectIds: string[] };
const emptyForm: ClassFormState = { title: '', levelId: '', subjectIds: [] };

type SubjectOption = { id: string; name: string; level_id: string | null };
type LevelOption = { id: string; name: string };
type ClassForEdit = { id: string; title: string; subject: string | null; subject_id: string | null; tutor_id: string | null };

type ClassFormModalProps = {
  open: boolean; mode: 'create' | 'edit'; editingClass: ClassForEdit | null;
  subjects: SubjectOption[]; levels: LevelOption[]; error: string | null;
  saving: boolean; onClose: () => void; onSubmit: (form: ClassFormState) => Promise<void> | void;
};

export default function ClassFormModal({ open, mode, editingClass, subjects, levels, error, saving, onClose, onSubmit }: ClassFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState<ClassFormState>(emptyForm);

  useEffect(() => {
    if (!open) { setForm(emptyForm); return; }
    if (mode === 'edit' && editingClass) { setForm({ title: editingClass.title ?? '', levelId: '', subjectIds: [] }); }
    else { setForm(emptyForm); }
  }, [open, mode, editingClass]);

  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeLevels = Array.isArray(levels) ? levels : [];

  const handleChangeTitle = (e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, title: e.target.value }));
  const handleChangeLevel = (e: ChangeEvent<HTMLSelectElement>) => setForm((prev) => ({ ...prev, levelId: e.target.value, subjectIds: [] }));
  const toggleSubject = (subjectId: string) => setForm((prev) => ({ ...prev, subjectIds: prev.subjectIds.includes(subjectId) ? prev.subjectIds.filter((id) => id !== subjectId) : [...prev.subjectIds, subjectId] }));
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); await onSubmit(form); };

  const subjectsForSelectedLevel = useMemo(() => {
    if (!form.levelId) return [];
    return safeSubjects.filter((s) => s.level_id === form.levelId);
  }, [safeSubjects, form.levelId]);

  if (!open) return null;
  const isCreate = mode === 'create';

  // Style helpers
  const modalBg = isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white';
  const labelCls = `flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const selectCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-800'}`;
  const hintCls = `text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const emptyBoxCls = `flex h-16 items-center justify-center rounded-xl border border-dashed ${isDark ? 'border-slate-700/60 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const subjectListCls = `max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const subjectItemCls = `flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'}`;
  const footerCls = `flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
        {/* Accent bar */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                {isCreate ? 'Νέο τμήμα' : 'Επεξεργασία τμήματος'}
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {isCreate ? 'Συμπληρώστε τα στοιχεία του νέου τμήματος' : `Επεξεργασία: ${editingClass?.title}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={closeBtnCls}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 pb-6">

            {/* Title */}
            <div className="space-y-1.5">
              <label className={labelCls}>
                <GraduationCap className="h-3 w-3" />
                Όνομα τμήματος <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input value={form.title} onChange={handleChangeTitle} required placeholder="π.χ. Τμήμα Α1" className={inputCls} />
            </div>

            {/* Level */}
            <div className="space-y-1.5">
              <label className={labelCls}>
                <Layers className="h-3 w-3" />
                Επίπεδο
              </label>
              <select value={form.levelId} onChange={handleChangeLevel} className={selectCls}>
                <option value="">Επιλέξτε επίπεδο…</option>
                {safeLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                ))}
              </select>
              <p className={hintCls}>Πρώτα επιλέξτε επίπεδο για να εμφανιστούν τα διαθέσιμα μαθήματα.</p>
            </div>

            {/* Subjects */}
            <div className="space-y-1.5">
              <label className={labelCls}>
                <BookOpen className="h-3 w-3" />
                Μαθήματα
                {form.subjectIds.length > 0 && (
                  <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>
                    {form.subjectIds.length}
                  </span>
                )}
              </label>

              {form.levelId === '' ? (
                <div className={emptyBoxCls}>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επιλέξτε πρώτα επίπεδο</p>
                </div>
              ) : subjectsForSelectedLevel.length === 0 ? (
                <div className={emptyBoxCls}>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα για αυτό το επίπεδο.</p>
                </div>
              ) : (
                <div className={subjectListCls}>
                  {subjectsForSelectedLevel.map((s) => {
                    const checked = form.subjectIds.includes(s.id);
                    return (
                      <label key={s.id} className={subjectItemCls}>
                        {checked
                          ? <CheckSquare className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
                          : <Square className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                        }
                        <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.id)} className="sr-only" />
                        <span className={checked ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}>
                          {s.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className={hintCls}>Μπορείτε να επιλέξετε πολλά μαθήματα από το ίδιο επίπεδο.</p>
            </div>
          </div>

          {/* Footer */}
          <div className={footerCls}>
            <button type="button" onClick={onClose} className={cancelBtnCls}>Ακύρωση</button>
            <button type="submit" disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {saving ? (<><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>) : isCreate ? 'Δημιουργία' : 'Αποθήκευση αλλαγών'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}