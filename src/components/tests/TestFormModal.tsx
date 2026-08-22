import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, ClipboardList, BookOpen, Tag, Calendar, Loader2, Users, Search, Plus, Euro } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppDatePicker from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import type { AddTestForm, ClassRow, ClassSubjectRow, EditTestForm, StudentRow, SubjectRow } from './types';
import { emptyForm } from './types';
import { parseDateDisplayToISO } from './utils';

function FormField({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const labelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{icon && <span className="opacity-70">{icon}</span>}{label}</label>
      {children}
      {hint && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
}

type TestFormModalProps = {
  open: boolean;
  mode: 'add' | 'edit';
  editTestData: EditTestForm | null;
  classes: ClassRow[];
  subjects: SubjectRow[];
  classSubjects: ClassSubjectRow[];
  students?: StudentRow[];
  isPrivateLessons?: boolean;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: AddTestForm) => Promise<void>;
};

export default function TestFormModal({
  open, mode, editTestData, classes, subjects, classSubjects, students, isPrivateLessons, error, saving, onClose, onSubmit,
}: TestFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState<AddTestForm>(emptyForm);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentDropOpen, setStudentDropOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editTestData) {
      const { id: _id, ...rest } = editTestData;
      setForm(rest);
    } else {
      setForm(emptyForm);
    }
    setStudentQuery('');
    setStudentDropOpen(false);
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

  const studentById = useMemo(() => {
    const m = new Map<string, StudentRow>(); (students ?? []).forEach((s) => m.set(s.id, s)); return m;
  }, [students]);
  const sortedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'el-GR')), [subjects]);
  const availableStudents = useMemo(() => {
    const assignedIds = new Set(form.studentAssignments.map((a) => a.studentId));
    return (students ?? []).filter((s) => !assignedIds.has(s.id)).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el-GR'));
  }, [students, form.studentAssignments]);
  const filteredAvailableStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return availableStudents;
    return availableStudents.filter((s) => (s.full_name ?? '').toLowerCase().includes(q));
  }, [availableStudents, studentQuery]);

  if (!open) return null;

  const handleFieldChange = (field: keyof AddTestForm) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return { ...prev, [field]: value as any };
    });
  };
  // Private lessons share a single subject across every assigned student — changing it
  // re-applies to all current assignments so the whole test always has one common subject.
  const handleCommonSubjectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const subjectId = e.target.value || null;
    setForm((prev) => ({
      ...prev,
      subjectId,
      studentAssignments: prev.studentAssignments.map((a) => ({ ...a, subjectId })),
    }));
  };
  const addStudentAssignment = (studentId: string) => {
    setForm((prev) => ({ ...prev, studentAssignments: [...prev.studentAssignments, { studentId, subjectId: prev.subjectId, chargeAmount: '' }] }));
  };
  const handleRemoveStudent = (studentId: string) => {
    setForm((prev) => ({ ...prev, studentAssignments: prev.studentAssignments.filter((a) => a.studentId !== studentId) }));
  };
  const handleChargeAmountChange = (studentId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      studentAssignments: prev.studentAssignments.map((a) => (a.studentId === studentId ? { ...a, chargeAmount: value } : a)),
    }));
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  // ── Styles ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
  const labelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const modalCardCls = isDark
    ? `relative w-full ${isPrivateLessons ? 'max-w-2xl' : 'max-w-md'} overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl`
    : `relative w-full ${isPrivateLessons ? 'max-w-2xl' : 'max-w-md'} overflow-hidden rounded-2xl border border-slate-200 shadow-2xl`;
  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';
  const cancelBtnCls = 'btn border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-red-400 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50';
  const assignmentRowCls = isDark
    ? 'flex flex-col gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5'
    : 'flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5';
  const removeBtnCls = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:bg-red-500/20';
  const chargeInputCls = isDark
    ? 'h-7 w-20 shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'h-7 w-20 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]';
  const studentDropPanelCls = isDark
    ? 'relative z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl'
    : 'relative z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl';
  const studentSearchInputCls = isDark
    ? 'h-8 w-full rounded-lg border border-slate-700/60 bg-slate-800/70 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-600 outline-none'
    : 'h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 outline-none';
  const studentRowOptionCls = isDark
    ? 'cursor-pointer px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/70'
    : 'cursor-pointer px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50';
  const addStudentBtnCls = isDark
    ? 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-[color:var(--color-accent)]/60 hover:text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40'
    : 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-[color:var(--color-accent)]/60 hover:text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40';

  const subOpts = isPrivateLessons ? [] : getSubjectsForClass(form.classId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <ClipboardList className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
              {mode === 'add' ? 'Νέο διαγώνισμα' : 'Επεξεργασία διαγωνίσματος'}
            </h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[65vh] overflow-y-auto px-6 pb-2">
            <div className="space-y-4">
              {isPrivateLessons ? (
                <>
                  <FormField label="Μαθητές *" icon={<Users className="h-3 w-3" />}
                    hint={form.studentAssignments.length === 0 ? 'Προσθέστε τουλάχιστον έναν μαθητή.' : undefined}>
                    {form.studentAssignments.length > 0 && (
                      <div className="mb-2.5 space-y-2">
                        {form.studentAssignments.map((a) => (
                          <div key={a.studentId} className={assignmentRowCls}>
                            <span className={`flex-1 truncate text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              {studentById.get(a.studentId)?.full_name ?? 'Άγνωστος'}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Euro className={`h-3 w-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Χρέωση"
                                value={a.chargeAmount ?? ''}
                                onChange={(e) => handleChargeAmountChange(a.studentId, e.target.value)}
                                className={chargeInputCls}
                                title="Χρέωση διαγωνίσματος για τον μαθητή"
                              />
                            </div>
                            <button type="button" onClick={() => handleRemoveStudent(a.studentId)} className={removeBtnCls}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button type="button" onClick={() => setStudentDropOpen((v) => !v)} disabled={availableStudents.length === 0}
                      className={addStudentBtnCls}>
                      <Plus className="h-3.5 w-3.5" />
                      {availableStudents.length === 0 ? 'Δεν υπάρχουν άλλοι διαθέσιμοι μαθητές' : 'Προσθήκη μαθητή'}
                    </button>

                    {studentDropOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setStudentDropOpen(false)} />
                        <div className={studentDropPanelCls}>
                          <div className="border-b p-2" style={{ borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.6)' }}>
                            <div className="relative">
                              <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                              <input autoFocus value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)}
                                placeholder="Αναζήτηση μαθητή..." className={studentSearchInputCls} />
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredAvailableStudents.length === 0 ? (
                              <p className={`px-3 py-2.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν μαθητές.</p>
                            ) : filteredAvailableStudents.map((s) => (
                              <div key={s.id} className={studentRowOptionCls}
                                onClick={() => { addStudentAssignment(s.id); setStudentDropOpen(false); setStudentQuery(''); }}>
                                {s.full_name ?? 'Χωρίς όνομα'}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </FormField>

                  <FormField label="Μάθημα *" icon={<Tag className="h-3 w-3" />}
                    hint={sortedSubjects.length === 0 ? 'Δεν έχουν οριστεί μαθήματα.' : undefined}>
                    <select className={inputCls} value={form.subjectId ?? ''} onChange={handleCommonSubjectChange} disabled={sortedSubjects.length === 0}>
                      <option value="">{sortedSubjects.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
                      {sortedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label="Τμήμα *" icon={<BookOpen className="h-3 w-3" />}>
                    <select className={inputCls} value={form.classId ?? ''} onChange={handleFieldChange('classId')} required>
                      <option value="">Επιλέξτε τμήμα</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Μάθημα *" icon={<Tag className="h-3 w-3" />} hint={subOpts.length === 0 && form.classId ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Μαθήματα».' : undefined}>
                    <select className={inputCls} value={form.subjectId ?? ''} onChange={handleFieldChange('subjectId')} disabled={subOpts.length === 0 || !form.classId}>
                      <option value="">{subOpts.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
                      {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FormField>
                </>
              )}
              <FormField label="Ημερομηνία *" icon={<Calendar className="h-3 w-3" />}>
                <AppDatePicker value={form.date} onChange={(v) => handleFieldChange('date')({ target: { value: v } } as any)} placeholder="π.χ. 12/05/2025" />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={labelCls}>Ώρα έναρξης *</label>
                  <TimePicker value={form.startTime} onChange={(t) => setForm((p) => ({ ...p, startTime: t }))} required />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Ώρα λήξης *</label>
                  <TimePicker value={form.endTime} onChange={(t) => setForm((p) => ({ ...p, endTime: t }))} required />
                </div>
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

export { parseDateDisplayToISO };
