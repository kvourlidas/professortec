import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, GraduationCap, BookOpen, Layers, Loader2, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  ModalErrorBox, modalInputCls, modalSelectCls,
} from '../ui/ModalField.tsx';
import StyledSelect from '../ui/StyledSelect';

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
  const toggleSubject = (subjectId: string) => setForm((prev) => ({ ...prev, subjectIds: prev.subjectIds.includes(subjectId) ? prev.subjectIds.filter((id) => id !== subjectId) : [...prev.subjectIds, subjectId] }));
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); await onSubmit(form); };

  const subjectsForSelectedLevel = useMemo(() => {
    if (!form.levelId) return [];
    return safeSubjects.filter((s) => s.level_id === form.levelId);
  }, [safeSubjects, form.levelId]);

  if (!open) return null;
  const isCreate = mode === 'create';

  // Style helpers
  const modalBg = isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white';
  const labelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);
  const hintCls = `text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const emptyBoxCls = `flex h-16 items-center justify-center rounded-xl border border-dashed ${isDark ? 'border-slate-700/60 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const subjectListCls = `max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const subjectItemCls = `flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'}`;
  const footerCls = `flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
                {isCreate ? 'Νέο τμήμα' : 'Επεξεργασία τμήματος'}
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>
                {isCreate ? 'Συμπληρώστε τα στοιχεία του νέου τμήματος' : `Επεξεργασία: ${editingClass?.title}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 pt-4 pb-6">

            {/* Title */}
            <FormField label="Όνομα τμήματος *" isDark={isDark}>
              <FieldIcon icon={GraduationCap} isDark={isDark} />
              <input value={form.title} onChange={handleChangeTitle} required placeholder="π.χ. Τμήμα Α1" className={inputCls} />
            </FormField>

            {/* Level */}
            <FormField label="Επίπεδο" hint="Πρώτα επιλέξτε επίπεδο για να εμφανιστούν τα διαθέσιμα μαθήματα." isDark={isDark}>
              <FieldIcon icon={Layers} isDark={isDark} />
              <StyledSelect
                isDark={isDark} className={selectCls}
                value={form.levelId}
                onChange={(v) => setForm((prev) => ({ ...prev, levelId: v, subjectIds: [] }))}
                options={[{ value: '', label: 'Επιλέξτε επίπεδο…' }, ...safeLevels.map((lvl) => ({ value: lvl.id, label: lvl.name }))]}
              />
              <ModalSelectChevron isDark={isDark} />
            </FormField>

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