import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, ClipboardList, BookOpen, Tag, Calendar, Clock, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppDatePicker from '../ui/AppDatePicker';
import type { AddTestForm, ClassRow, ClassSubjectRow, EditTestForm, SubjectRow } from './types';
import { emptyForm } from './types';
import { convert12To24, convert24To12, formatTimeInput, parseDateDisplayToISO } from './utils';

type TestFormModalProps = {
  open: boolean;
  mode: 'add' | 'edit';
  editTestData: EditTestForm | null;
  classes: ClassRow[];
  subjects: SubjectRow[];
  classSubjects: ClassSubjectRow[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: AddTestForm) => Promise<void>;
};

export default function TestFormModal({
  open, mode, editTestData, classes, subjects, classSubjects, error, saving, onClose, onSubmit,
}: TestFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState<AddTestForm>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editTestData) {
      const { id: _id, ...rest } = editTestData;
      setForm(rest);
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, editTestData]);

  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m;
  }, [subjects]);

  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId) ?? null;
    const attachedIds = new Set<string>();
    classSubjects.filter((cs) => cs.class_id === classId && cs.subject_id).forEach((cs) => attachedIds.add(cs.subject_id));
    if (cls?.subject_id) attachedIds.add(cls.subject_id);
    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => { const s = subjectById.get(id); if (s) attachedSubjects.push(s); });
    if (attachedSubjects.length >= 2) return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    let levelId: string | null = null;
    if (cls?.subject_id) { const mainSubj = subjectById.get(cls.subject_id); levelId = mainSubj?.level_id ?? null; }
    const extraSubjects = levelId ? subjects.filter((s) => s.level_id === levelId) : subjects;
    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
  };

  if (!open) return null;

  const handleFieldChange = (field: keyof AddTestForm) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return { ...prev, [field]: value as any };
    });
  };
  const handleTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: formatTimeInput(e.target.value) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  // ── Styles ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
  const timeInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-3 pr-16 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-16 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
  const periodSelectCls = isDark
    ? 'absolute inset-y-1 right-1 rounded-md border border-slate-600/60 bg-slate-800/80 px-1.5 text-[10px] text-slate-300 outline-none'
    : 'absolute inset-y-1 right-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[10px] text-slate-700 outline-none';
  const labelCls = `flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';
  const modalTitleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';
  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';
  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  // ── Sub-components ──
  const FormField = ({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className={labelCls}>{icon && <span className="opacity-70">{icon}</span>}{label}</label>
      {children}
      {hint && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );

  const TimeField = ({ label, value, onChange, period, onPeriod }: { label: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; period: 'AM' | 'PM'; onPeriod: (p: 'AM' | 'PM') => void }) => (
    <FormField label={label} icon={<Clock className="h-3 w-3" />}>
      <div className="relative">
        <input type="text" inputMode="numeric" placeholder="π.χ. 08:00" value={value} onChange={onChange} className={timeInputCls} />
        <select value={period} onChange={(e) => onPeriod(e.target.value as 'AM' | 'PM')} className={periodSelectCls}>
          <option value="AM">AM</option><option value="PM">PM</option>
        </select>
      </div>
    </FormField>
  );

  const subOpts = getSubjectsForClass(form.classId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <ClipboardList className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className={modalTitleCls}>
              {mode === 'add' ? 'Νέο διαγώνισμα' : 'Επεξεργασία διαγωνίσματος'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={modalCloseBtnCls}><X className="h-3.5 w-3.5" /></button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-2">
            <div className="space-y-4">
              <FormField label="Τμήμα *" icon={<BookOpen className="h-3 w-3" />}>
                <select className={inputCls} value={form.classId ?? ''} onChange={handleFieldChange('classId')} required>
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </FormField>
              <FormField label="Μάθημα *" icon={<Tag className="h-3 w-3" />} hint={subOpts.length === 0 && form.classId ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
                <select className={inputCls} value={form.subjectId ?? ''} onChange={handleFieldChange('subjectId')} disabled={subOpts.length === 0 || !form.classId}>
                  <option value="">{subOpts.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
                  {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Ημερομηνία *" icon={<Calendar className="h-3 w-3" />}>
                <AppDatePicker value={form.date} onChange={(v) => handleFieldChange('date')({ target: { value: v } } as any)} placeholder="π.χ. 12/05/2025" />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <TimeField label="Ώρα έναρξης *" value={form.startTime} onChange={handleTimeChange('startTime')} period={form.startPeriod} onPeriod={(p) => handleFieldChange('startPeriod')({ target: { value: p } } as any)} />
                <TimeField label="Ώρα λήξης *" value={form.endTime} onChange={handleTimeChange('endTime')} period={form.endPeriod} onPeriod={(p) => handleFieldChange('endPeriod')({ target: { value: p } } as any)} />
              </div>
              <FormField label="Τίτλος (προαιρετικό)" icon={<Tag className="h-3 w-3" />}>
                <input className={inputCls} placeholder="π.χ. Διαγώνισμα Κεφαλαίου 3" value={form.title} onChange={handleFieldChange('title')} />
              </FormField>
            </div>
          </div>

          <div className={modalFooterCls}>
            <button type="button" onClick={onClose} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
            <button type="submit" disabled={saving} className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : mode === 'add' ? 'Αποθήκευση' : 'Ενημέρωση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { parseDateDisplayToISO, convert12To24 };
