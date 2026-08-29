import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, ClipboardList, BookOpen, Tag, Loader2, Plus, Euro, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppDatePicker from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  ModalErrorBox, modalInputCls, modalSelectCls,
} from '../ui/ModalField';
import StyledSelect from '../ui/StyledSelect';
import type { AddTestForm, ClassRow, ClassSubjectRow, EditTestForm, StudentRow, SubjectRow } from './types';
import { emptyForm } from './types';
import { parseDateDisplayToISO } from './utils';

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

  const getCommonSubjectsForClasses = (classIds: string[]): SubjectRow[] => {
    if (classIds.length === 0) return [];
    const perClass = classIds.map((id) => getSubjectsForClass(id));
    const [first, ...rest] = perClass;
    return first.filter((s) => rest.every((list) => list.some((x) => x.id === s.id)));
  };

  const studentById = useMemo(() => {
    const m = new Map<string, StudentRow>(); (students ?? []).forEach((s) => m.set(s.id, s)); return m;
  }, [students]);
  const sortedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'el-GR')), [subjects]);
  const availableStudents = useMemo(() => {
    const assignedIds = new Set(form.studentAssignments.map((a) => a.studentId));
    return (students ?? []).filter((s) => !assignedIds.has(s.id)).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el-GR'));
  }, [students, form.studentAssignments]);
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
  const toggleClassId = (classId: string) => {
    setForm((prev) => {
      const has = prev.classIds.includes(classId);
      const nextIds = has ? prev.classIds.filter((id) => id !== classId) : [...prev.classIds, classId];
      const nextOpts = getCommonSubjectsForClasses(nextIds);
      const subjectStillValid = prev.subjectId && nextOpts.some((s) => s.id === prev.subjectId);
      return { ...prev, classIds: nextIds, subjectId: subjectStillValid ? prev.subjectId : null };
    });
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
  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);
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
  const classLabelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const classHintCls = `text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const classEmptyBoxCls = `flex h-16 items-center justify-center rounded-xl border border-dashed ${isDark ? 'border-slate-700/60 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const classListCls = `max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const classItemCls = `flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'}`;

  const subOpts = isPrivateLessons ? [] : mode === 'add' ? getCommonSubjectsForClasses(form.classIds) : getSubjectsForClass(form.classId);
  const hasClassSelection = mode === 'add' ? form.classIds.length > 0 : !!form.classId;

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
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[65vh] overflow-y-auto px-6 pb-2">
            <div className="space-y-4">
              {isPrivateLessons ? (
                <>
                  <FormField label="Μαθητές *" isDark={isDark}
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

                    {availableStudents.length > 0 && (
                      <div className="relative">
                        <FieldIcon icon={Plus} isDark={isDark} />
                        <StyledSelect
                          isDark={isDark} className={selectCls}
                          value="" onChange={(v) => { if (v) addStudentAssignment(v); }}
                          placeholder="Προσθήκη μαθητή…"
                          options={availableStudents.map((s) => ({ value: s.id, label: s.full_name ?? 'Μαθητής' }))}
                        />
                        <ModalSelectChevron isDark={isDark} />
                      </div>
                    )}
                  </FormField>

                  <FormField label="Μάθημα *" isDark={isDark}
                    hint={sortedSubjects.length === 0 ? 'Δεν έχουν οριστεί μαθήματα.' : undefined}>
                    <FieldIcon icon={Tag} isDark={isDark} />
                    <StyledSelect
                      isDark={isDark} className={selectCls}
                      value={form.subjectId ?? ''}
                      onChange={(v) => handleCommonSubjectChange({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                      disabled={sortedSubjects.length === 0}
                      options={[
                        { value: '', label: sortedSubjects.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα' },
                        ...sortedSubjects.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                    />
                    <ModalSelectChevron isDark={isDark} />
                  </FormField>
                </>
              ) : (
                <>
                  {mode === 'edit' ? (
                    <FormField label="Τμήμα *" isDark={isDark}>
                      <FieldIcon icon={BookOpen} isDark={isDark} />
                      <StyledSelect
                        isDark={isDark} className={selectCls}
                        value={form.classId ?? ''}
                        onChange={(v) => handleFieldChange('classId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                        options={[{ value: '', label: 'Επιλέξτε τμήμα' }, ...classes.map((c) => ({ value: c.id, label: c.title }))]}
                      />
                      <ModalSelectChevron isDark={isDark} />
                    </FormField>
                  ) : (
                    <div className="space-y-1.5">
                      <label className={classLabelCls}>
                        <BookOpen className="h-3 w-3" />
                        Τμήματα *
                        {form.classIds.length > 0 && (
                          <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>
                            {form.classIds.length}
                          </span>
                        )}
                      </label>
                      {classes.length === 0 ? (
                        <div className={classEmptyBoxCls}>
                          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν τμήματα.</p>
                        </div>
                      ) : (
                        <div className={classListCls}>
                          {classes.map((c) => {
                            const checked = form.classIds.includes(c.id);
                            return (
                              <label key={c.id} className={classItemCls}>
                                {checked
                                  ? <CheckSquare className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
                                  : <Square className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />}
                                <input type="checkbox" checked={checked} onChange={() => toggleClassId(c.id)} className="sr-only" />
                                <span className={checked ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}>
                                  {c.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <p className={classHintCls}>Μπορείτε να επιλέξετε πολλά τμήματα — θα δημιουργηθεί ξεχωριστό διαγώνισμα για κάθε τμήμα.</p>
                    </div>
                  )}
                  <FormField label="Μάθημα *" isDark={isDark} hint={subOpts.length === 0 && hasClassSelection ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Μαθήματα».' : undefined}>
                    <FieldIcon icon={Tag} isDark={isDark} />
                    <StyledSelect
                      isDark={isDark} className={selectCls}
                      value={form.subjectId ?? ''}
                      onChange={(v) => handleFieldChange('subjectId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                      disabled={subOpts.length === 0 || !hasClassSelection}
                      options={[
                        { value: '', label: subOpts.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα' },
                        ...subOpts.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                    />
                    <ModalSelectChevron isDark={isDark} />
                  </FormField>
                </>
              )}
              <FormField label="Ημερομηνία *" isDark={isDark}>
                <AppDatePicker value={form.date} onChange={(v) => handleFieldChange('date')({ target: { value: v } } as any)} placeholder="π.χ. 12/05/2025" variant="underline" />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Ώρα έναρξης *" isDark={isDark}>
                  <TimePicker value={form.startTime} onChange={(t) => setForm((p) => ({ ...p, startTime: t }))} required />
                </FormField>
                <FormField label="Ώρα λήξης *" isDark={isDark}>
                  <TimePicker value={form.endTime} onChange={(t) => setForm((p) => ({ ...p, endTime: t }))} required />
                </FormField>
              </div>
              <FormField label="Τίτλος (προαιρετικό)" isDark={isDark}>
                <FieldIcon icon={Tag} isDark={isDark} />
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
