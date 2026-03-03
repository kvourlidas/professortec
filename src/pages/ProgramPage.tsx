// src/pages/ProgramPage.tsx
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import AppDatePicker from '../components/ui/AppDatePicker';
import {
  CalendarDays, Search, Clock, Calendar, BookOpen,
  GraduationCap, Layers, X, Loader2, ChevronDown,
} from 'lucide-react';

// ── Types (unchanged) ────────────────────────────────────────────────────────

type ClassRow = { id: string; school_id: string; title: string; subject: string | null; subject_id: string | null; tutor_id: string | null };
type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null };
type LevelRow = { id: string; school_id: string; name: string };
type TutorRow = { id: string; school_id: string; full_name: string };
type ProgramRow = { id: string; school_id: string; name: string; description: string | null };
type ProgramItemRow = { id: string; program_id: string; class_id: string; day_of_week: string; position: number | null; start_time: string | null; end_time: string | null; start_date: string | null; end_date: string | null; subject_id: string | null; tutor_id: string | null };
type ClassSubjectRow = { class_id: string; subject_id: string };
type SubjectTutorRow = { subject_id: string; tutor_id: string };

type AddSlotForm = { classId: string | null; subjectId: string | null; tutorId: string | null; day: string; startTime: string; startPeriod: 'AM' | 'PM'; endTime: string; endPeriod: 'AM' | 'PM'; startDate: string; endDate: string };
type EditSlotForm = { id: string; classId: string | null; subjectId: string | null; tutorId: string | null; day: string; startTime: string; startPeriod: 'AM' | 'PM'; endTime: string; endPeriod: 'AM' | 'PM'; startDate: string; endDate: string };

const emptyAddSlotForm: AddSlotForm = { classId: null, subjectId: null, tutorId: null, day: '', startTime: '', startPeriod: 'PM', endTime: '', endPeriod: 'PM', startDate: '', endDate: '' };

const DAY_OPTIONS = [
  { value: 'monday', label: 'ΔΕΥΤΕΡΑ' },
  { value: 'tuesday', label: 'ΤΡΙΤΗ' },
  { value: 'wednesday', label: 'ΤΕΤΑΡΤΗ' },
  { value: 'thursday', label: 'ΠΕΜΠΤΗ' },
  { value: 'friday', label: 'ΠΑΡΑΣΚΕΥΗ' },
  { value: 'saturday', label: 'ΣΑΒΒΑΤΟ' },
  { value: 'sunday', label: 'ΚΥΡΙΑΚΗ' },
];

const DAY_LABEL_BY_VALUE: Record<string, string> = DAY_OPTIONS.reduce((acc, d) => { acc[d.value] = d.label; return acc; }, {} as Record<string, string>);

// ── Helpers (unchanged) ───────────────────────────────────────────────────────

const pad2 = (n: number) => n.toString().padStart(2, '0');

function convert12To24(time: string, period: 'AM' | 'PM'): string | null {
  const t = time.trim();
  if (!t) return null;
  const [hStr, mStr = '00'] = t.split(':');
  let h = Number(hStr); let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  h = h % 12;
  if (period === 'PM') h += 12;
  else if (period === 'AM' && h === 12) h = 0;
  return `${pad2(h)}:${pad2(m)}`;
}

function convert24To12(time: string | null): { time: string; period: 'AM' | 'PM' } {
  if (!time) return { time: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { time: '', period: 'AM' };
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { time: `${pad2(h)}:${pad2(m)}`, period };
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [hStr, mStr = '00'] = t.split(':');
  const h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatTimeDisplay(t: string | null): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Shared form components ────────────────────────────────────────────────────

const inputCls = "h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-60";
const selectCls = inputCls;

function FormField({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-amber-400">{hint}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [subjectTutors, setSubjectTutors] = useState<SubjectTutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragClassId, setDragClassId] = useState<string | null>(null);
  const [classSearch, setClassSearch] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddSlotForm>(emptyAddSlotForm);
  const [savingSlot, setSavingSlot] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditSlotForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteSlotTarget, setDeleteSlotTarget] = useState<{ id: string; classLabel: string; dayLabel: string; timeRange: string } | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);

  // ── Maps ──

  const levelNameById = useMemo(() => { const m = new Map<string, string>(); levels.forEach((lvl) => m.set(lvl.id, lvl.name)); return m; }, [levels]);
  const tutorNameById = useMemo(() => { const m = new Map<string, string>(); tutors.forEach((t) => m.set(t.id, t.full_name)); return m; }, [tutors]);
  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);

  const filteredClasses = useMemo(() => {
    const q = normalizeText(classSearch.trim());
    if (!q) return classes;
    return classes.filter((cls) => {
      const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
      const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
      const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
      return normalizeText([cls.title, cls.subject, levelName, tutorName].filter(Boolean).join(' ')).includes(q);
    });
  }, [classes, classSearch, subjectById, levelNameById, tutorNameById]);

  const currentEditClass = useMemo(() => {
    if (!editForm) return null;
    return classes.find((c) => c.id === editForm.classId) ?? null;
  }, [editForm, classes]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, ProgramItemRow[]> = {};
    DAY_OPTIONS.forEach((d) => { map[d.value] = []; });
    programItems.forEach((item) => {
      if (!map[item.day_of_week]) map[item.day_of_week] = [];
      map[item.day_of_week].push(item);
    });
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => {
        const ta = timeToMinutes(a.start_time); const tb = timeToMinutes(b.start_time);
        if (ta !== tb) return ta - tb;
        return (a.position ?? 0) - (b.position ?? 0);
      });
    });
    return map;
  }, [programItems]);

  // ── Load ──

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data: programRows, error: programErr } = await supabase.from('programs').select('*').eq('school_id', schoolId).order('created_at', { ascending: true });
        if (programErr) throw programErr;
        let activeProgram: ProgramRow | null = (programRows?.[0] as ProgramRow) ?? null;
        if (!activeProgram) {
          const { data: created, error: createErr } = await supabase.from('programs').insert({ school_id: schoolId, name: 'Βασικό πρόγραμμα', description: null }).select('*').maybeSingle();
          if (createErr || !created) throw createErr ?? new Error('Failed to create default program');
          activeProgram = created as ProgramRow;
        }
        setProgram(activeProgram);

        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: levelData, error: lvlErr },
          { data: tutorData, error: tutorErr },
          { data: itemData, error: itemErr },
        ] = await Promise.all([
          supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true }),
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('levels').select('id, school_id, name').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('tutors').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true }),
          supabase.from('program_items').select('*').eq('program_id', activeProgram.id).order('day_of_week', { ascending: true }).order('position', { ascending: true }),
        ]);

        if (classErr) throw classErr; if (subjErr) throw subjErr; if (lvlErr) throw lvlErr; if (tutorErr) throw tutorErr; if (itemErr) throw itemErr;

        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setLevels((levelData ?? []) as LevelRow[]);
        setTutors((tutorData ?? []) as TutorRow[]);
        setProgramItems((itemData ?? []) as ProgramItemRow[]);

        try {
          const { data: csData, error: csErr } = await supabase.from('class_subjects').select('class_id, subject_id');
          setClassSubjects(csErr ? [] : (csData ?? []) as ClassSubjectRow[]);
        } catch { setClassSubjects([]); }

        try {
          const { data: stData, error: stErr } = await supabase.from('subject_tutors').select('subject_id, tutor_id').eq('school_id', schoolId);
          setSubjectTutors(stErr ? [] : (stData ?? []) as SubjectTutorRow[]);
        } catch { setSubjectTutors([]); }

      } catch (err: any) {
        console.error('ProgramPage load error', err);
        setError('Αποτυχία φόρτωσης προγράμματος.');
      } finally { setLoading(false); }
    };
    load();
  }, [schoolId]);

  // ── Subject / tutor helpers (unchanged logic) ─────────────────────────────

  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId) ?? null;
    const attachedIds = new Set<string>();
    classSubjects.filter((cs) => cs.class_id === classId && cs.subject_id).forEach((cs) => attachedIds.add(cs.subject_id));
    if (cls?.subject_id) attachedIds.add(cls.subject_id);
    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => { const subj = subjectById.get(id); if (subj) attachedSubjects.push(subj); });
    if (attachedSubjects.length >= 2) return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    let levelId: string | null = null;
    if (cls?.subject_id) { const mainSubj = subjectById.get(cls.subject_id); levelId = mainSubj?.level_id ?? null; }
    let extraSubjects: SubjectRow[] = levelId ? subjects.filter((s) => s.level_id === levelId) : subjects;
    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
  };

  const getTutorsForSubject = (subjectId: string | null): TutorRow[] => {
    if (!subjectId) return [];
    const tutorIds = Array.from(new Set(subjectTutors.filter((st) => st.subject_id === subjectId).map((st) => st.tutor_id)));
    const result: TutorRow[] = [];
    tutorIds.forEach((id) => { const tutor = tutors.find((t) => t.id === id); if (tutor) result.push(tutor); });
    return result;
  };

  // ── Add slot ─────────────────────────────────────────────────────────────

  const openAddSlotModal = (classId: string, day: string) => {
    const displayToday = formatDateDisplay(todayISO());
    setError(null);
    setAddForm({ classId, subjectId: null, tutorId: null, day, startTime: '', startPeriod: 'PM', endTime: '', endPeriod: 'PM', startDate: displayToday, endDate: displayToday });
    setAddModalOpen(true);
  };

  const closeAddSlotModal = () => { setAddModalOpen(false); setAddForm(emptyAddSlotForm); setSavingSlot(false); };

  const handleAddTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) =>
    setAddForm((prev) => ({ ...prev, [field]: formatTimeInput(e.target.value) }));

  const handleAddFieldChange = (field: keyof AddSlotForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setAddForm((prev) => {
      if (field === 'subjectId') return { ...prev, subjectId: value || null, tutorId: null };
      if (field === 'tutorId') return { ...prev, tutorId: value || null };
      return { ...prev, [field]: value as any };
    });
  };

  const handleConfirmAddSlot = async () => {
    if (!program) return;
    if (!addForm.classId || !addForm.day) { setError('Επιλέξτε τμήμα και ημέρα.'); return; }
    const subjectsForClass = getSubjectsForClass(addForm.classId);
    if (subjectsForClass.length === 0) { setError('Το τμήμα δεν έχει συνδεδεμένα μαθήματα. Ρυθμίστε τα στη σελίδα «Τμήματα».'); return; }
    if (!addForm.subjectId) { setError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    const start24 = convert12To24(addForm.startTime, addForm.startPeriod);
    const end24 = convert12To24(addForm.endTime, addForm.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).'); return; }
    if (!addForm.startDate || !addForm.endDate) { setError('Συμπληρώστε ημερομηνία έναρξης και λήξης.'); return; }
    const startDateISO = parseDateDisplayToISO(addForm.startDate);
    const endDateISO = parseDateDisplayToISO(addForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες (π.χ. 12/05/2025).'); return; }
    const itemsForDay = programItems.filter((i) => i.day_of_week === addForm.day && i.program_id === program.id);
    const maxPos = itemsForDay.reduce((max, i) => Math.max(max, i.position ?? 0), 0);
    setSavingSlot(true); setError(null);
    const { data, error } = await supabase.from('program_items').insert({ program_id: program.id, class_id: addForm.classId, subject_id: addForm.subjectId, tutor_id: addForm.tutorId, day_of_week: addForm.day, position: maxPos + 1, start_time: start24, end_time: end24, start_date: startDateISO, end_date: endDateISO }).select('*').maybeSingle();
    setSavingSlot(false);
    if (error || !data) { console.error(error); setError('Αποτυχία προσθήκης τμήματος στο πρόγραμμα.'); return; }
    setProgramItems((prev) => [...prev, data as ProgramItemRow]);
    closeAddSlotModal();
  };

  // ── Edit slot ─────────────────────────────────────────────────────────────

  const openEditSlotModal = (item: ProgramItemRow) => {
    const { time: startTime, period: startPeriod } = convert24To12(item.start_time);
    const { time: endTime, period: endPeriod } = convert24To12(item.end_time);
    setError(null);
    setEditForm({ id: item.id, classId: item.class_id, subjectId: item.subject_id ?? null, tutorId: item.tutor_id ?? null, day: item.day_of_week, startTime, startPeriod, endTime, endPeriod, startDate: item.start_date ? formatDateDisplay(item.start_date) : '', endDate: item.end_date ? formatDateDisplay(item.end_date) : '' });
    setEditModalOpen(true);
  };

  const closeEditSlotModal = () => { if (savingEdit) return; setEditModalOpen(false); setEditForm(null); };

  const handleEditTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) =>
    setEditForm((prev) => prev ? { ...prev, [field]: formatTimeInput(e.target.value) } : prev);

  const handleEditFieldChange = (field: keyof EditSlotForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setEditForm((prev) => {
      if (!prev) return prev;
      if (field === 'subjectId') return { ...prev, subjectId: value || null, tutorId: null };
      if (field === 'tutorId') return { ...prev, tutorId: value || null };
      return { ...prev, [field]: value as any };
    });
  };

  const handleConfirmEditSlot = async () => {
    if (!program || !editForm) return;
    if (!editForm.classId || !editForm.day) { setError('Επιλέξτε τμήμα και ημέρα.'); return; }
    const subjectsForClass = getSubjectsForClass(editForm.classId);
    if (subjectsForClass.length > 0 && !editForm.subjectId) { setError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    const start24 = convert12To24(editForm.startTime, editForm.startPeriod);
    const end24 = convert12To24(editForm.endTime, editForm.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες.'); return; }
    const startDateISO = parseDateDisplayToISO(editForm.startDate);
    const endDateISO = parseDateDisplayToISO(editForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες.'); return; }
    setSavingEdit(true); setError(null);
    const { data, error } = await supabase.from('program_items').update({ class_id: editForm.classId, subject_id: editForm.subjectId, tutor_id: editForm.tutorId, day_of_week: editForm.day, start_time: start24, end_time: end24, start_date: startDateISO, end_date: endDateISO }).eq('id', editForm.id).select('*').maybeSingle();
    setSavingEdit(false);
    if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης τμήματος στο πρόγραμμα.'); return; }
    setProgramItems((prev) => prev.map((i) => (i.id === editForm.id ? (data as ProgramItemRow) : i)));
    closeEditSlotModal();
  };

  // ── Delete slot ───────────────────────────────────────────────────────────

  const handleConfirmDeleteSlot = async () => {
    if (!deleteSlotTarget) return;
    const id = deleteSlotTarget.id;
    const previous = programItems;
    try {
      setDeletingSlot(true); setError(null);
      setProgramItems((prev) => prev.filter((i) => i.id !== id));
      const { error } = await supabase.from('program_items').delete().eq('id', id);
      if (error) { console.error(error); setError('Αποτυχία διαγραφής από το πρόγραμμα.'); setProgramItems(previous); return; }
      setDeleteSlotTarget(null);
    } finally { setDeletingSlot(false); }
  };

  const handleDropOnDay = (day: string) => {
    if (!dragClassId) return;
    openAddSlotModal(dragClassId, day);
    setDragClassId(null);
  };

  // ── Slot form shared JSX (add & edit share the same fields) ──────────────

  const SlotFormFields = ({
    classTitle, dayValue, onDayChange,
    subjectId, onSubjectChange,
    tutorId, onTutorChange,
    startTime, onStartTimeChange, startPeriod, onStartPeriodChange,
    endTime, onEndTimeChange, endPeriod, onEndPeriodChange,
    startDate, onStartDateChange,
    endDate, onEndDateChange,
    classId, isEdit,
  }: {
    classTitle: string; dayValue: string; onDayChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
    subjectId: string | null; onSubjectChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    tutorId: string | null; onTutorChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    startTime: string; onStartTimeChange: (e: ChangeEvent<HTMLInputElement>) => void;
    startPeriod: 'AM' | 'PM'; onStartPeriodChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    endTime: string; onEndTimeChange: (e: ChangeEvent<HTMLInputElement>) => void;
    endPeriod: 'AM' | 'PM'; onEndPeriodChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    startDate: string; onStartDateChange: (v: string) => void;
    endDate: string; onEndDateChange: (v: string) => void;
    classId: string | null; isEdit: boolean;
  }) => {
    const subjOptions = getSubjectsForClass(classId);
    const tutorOptions = getTutorsForSubject(subjectId);

    return (
      <div className="space-y-4">
        {/* Class + Day */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Τμήμα" icon={<GraduationCap className="h-3 w-3" />}>
            <input disabled value={classTitle} className={inputCls} />
          </FormField>

          <FormField label="Ημέρα" icon={<CalendarDays className="h-3 w-3" />}>
            {isEdit && onDayChange ? (
              <select className={selectCls} value={dayValue} onChange={onDayChange}>
                {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            ) : (
              <input disabled value={DAY_LABEL_BY_VALUE[dayValue] || ''} className={inputCls} />
            )}
          </FormField>
        </div>

        {/* Subject + Tutor */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Μάθημα" icon={<BookOpen className="h-3 w-3" />}
            hint={subjOptions.length === 0 ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
            <select className={selectCls} value={subjectId ?? ''} onChange={onSubjectChange} disabled={subjOptions.length === 0}>
              <option value="">{subjOptions.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
              {subjOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>

          <FormField label="Καθηγητής" icon={<Layers className="h-3 w-3" />}>
            <select className={selectCls} value={tutorId ?? ''} onChange={onTutorChange} disabled={!subjectId || tutorOptions.length === 0}>
              <option value="">{tutorOptions.length === 0 ? 'Δεν έχουν οριστεί καθηγητές' : 'Επιλέξτε (προαιρετικό)'}</option>
              {tutorOptions.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </FormField>
        </div>

        {/* Times */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Ώρα έναρξης', time: startTime, onChange: onStartTimeChange, period: startPeriod, onPeriod: onStartPeriodChange },
            { label: 'Ώρα λήξης', time: endTime, onChange: onEndTimeChange, period: endPeriod, onPeriod: onEndPeriodChange },
          ].map(({ label, time, onChange, period, onPeriod }) => (
            <FormField key={label} label={label} icon={<Clock className="h-3 w-3" />}>
              <div className="relative">
                <input type="text" inputMode="numeric" placeholder="π.χ. 08:00" value={time} onChange={onChange}
                  className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-3 pr-20 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30" />
                <select value={period} onChange={onPeriod}
                  className="absolute inset-y-1 right-1 w-16 rounded-md border border-slate-600/60 bg-slate-800 px-1.5 text-[10px] text-slate-200 outline-none">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </FormField>
          ))}
        </div>

        {/* Dates */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Ημερομηνία έναρξης" icon={<Calendar className="h-3 w-3" />}>
            <AppDatePicker value={startDate} onChange={onStartDateChange} placeholder="π.χ. 12/05/2025" />
          </FormField>
          <FormField label="Ημερομηνία λήξης" icon={<Calendar className="h-3 w-3" />}>
            <AppDatePicker value={endDate} onChange={onEndDateChange} placeholder="π.χ. 12/05/2025" />
          </FormField>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <CalendarDays className="h-4.5 w-4.5 text-black" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-slate-50">Πρόγραμμα Τμημάτων</h1>
          <p className="mt-0.5 text-xs text-slate-400">Δημιούργησε ένα εβδομαδιαίο πρόγραμμα, προσθέτοντας τμήματα σε κάθε μέρα.</p>
          {program && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-0.5 text-[11px] text-slate-300">
              <CalendarDays className="h-3 w-3 text-slate-400" />
              {program.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          <p className="text-xs text-slate-400">Φόρτωση προγράμματος…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">

          {/* ── Left: available classes ── */}
          <section className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04] lg:w-[320px] shrink-0">
            {/* Panel header */}
            <div className="border-b border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                Διαθέσιμα τμήματα
              </h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Σύρετε ή επιλέξτε μέρα για προσθήκη.</p>
            </div>

            <div className="p-3 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  className="h-8 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30"
                  placeholder="Αναζήτηση τμήματος..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                />
              </div>

              {/* Class list */}
              {classes.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-500">Δεν υπάρχουν ακόμη τμήματα.</p>
              ) : filteredClasses.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-500">Δεν βρέθηκαν τμήματα.</p>
              ) : (
                <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-0.5">
                  {filteredClasses.map((cls) => {
                    const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
                    const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
                    const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
                    const metaParts = [cls.subject, levelName, tutorName].filter(Boolean);

                    return (
                      <div key={cls.id}
                        className="group flex items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/30 px-3 py-2.5 transition hover:border-slate-600/60 hover:bg-slate-800/40 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={() => setDragClassId(cls.id)}
                        onDragEnd={() => setDragClassId((prev) => (prev === cls.id ? null : prev))}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">{cls.title || 'Τμήμα'}</div>
                          {metaParts.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-slate-400 truncate">{metaParts.join(' · ')}</div>
                          )}
                        </div>

                        <div className="relative shrink-0">
                          <select
                            className="h-7 appearance-none rounded-lg border border-slate-600/60 bg-slate-800/80 pl-2 pr-6 text-[10px] text-slate-200 outline-none transition hover:border-slate-500 focus:border-[color:var(--color-accent)]"
                            defaultValue=""
                            onChange={(e) => {
                              const day = e.target.value;
                              if (!day) return;
                              openAddSlotModal(cls.id, day);
                              e.target.value = '';
                            }}
                          >
                            <option value="">+ Μέρα</option>
                            {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── Right: weekly schedule ── */}
          <section className="flex-1 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
            <div className="border-b border-slate-700/60 bg-slate-900/40 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                Εβδομαδιαίο πλάνο
              </h2>
            </div>

            <div className="overflow-x-auto p-3">
              <div className="min-w-[700px] grid grid-cols-7 gap-2">
                {DAY_OPTIONS.map((day) => (
                  <div key={day.value}
                    className={`flex flex-col rounded-xl border transition-colors ${dragClassId ? 'border-dashed border-slate-500/60 bg-slate-800/30' : 'border-slate-700/40 bg-slate-900/20'}`}
                    onDragOver={(e) => { if (dragClassId) e.preventDefault(); }}
                    onDrop={() => handleDropOnDay(day.value)}
                  >
                    {/* Day header */}
                    <div className="border-b border-slate-700/40 px-2 py-2 text-center text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                      {day.label}
                    </div>

                    {/* Slots */}
                    <div className="flex-1 space-y-1.5 p-1.5 min-h-[120px]">
                      {itemsByDay[day.value]?.length === 0 ? (
                        <div className="flex h-full min-h-[80px] items-center justify-center rounded-lg border border-dashed border-slate-700/40 bg-white/[0.02]">
                          <p className="text-[9px] text-center text-slate-600 px-1">Σύρετε τμήμα εδώ</p>
                        </div>
                      ) : (
                        itemsByDay[day.value].map((item) => {
                          const cls = classes.find((c) => c.id === item.class_id);
                          if (!cls) return null;
                          const subjForItem = item.subject_id ? subjectById.get(item.subject_id) : cls.subject_id ? subjectById.get(cls.subject_id) : null;
                          const subjName = subjForItem?.name ?? cls.subject ?? '';
                          const tutorNameForItem = item.tutor_id ? (tutorNameById.get(item.tutor_id) ?? '') : cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';

                          const timeRange = item.start_time && item.end_time
                            ? `${formatTimeDisplay(item.start_time)} – ${formatTimeDisplay(item.end_time)}`
                            : '';

                          const classLabel = [cls.title, subjName, tutorNameForItem].filter(Boolean).join(' · ');

                          return (
                            <div key={item.id}
                              className="group relative cursor-pointer rounded-lg border border-slate-600/40 bg-slate-800/50 px-2 py-1.5 text-[10px] transition hover:border-[color:var(--color-accent)]/50 hover:bg-slate-700/50"
                              onClick={() => openEditSlotModal(item)}
                            >
                              <button type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteSlotTarget({ id: item.id, classLabel, dayLabel: DAY_LABEL_BY_VALUE[item.day_of_week] ?? '', timeRange });
                                }}
                                className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded text-[9px] text-red-400 hover:text-red-300 group-hover:flex"
                              >
                                ✕
                              </button>
                              <div className="font-semibold text-slate-100 leading-tight pr-3">{cls.title}</div>
                              {subjName && <div className="text-[9px] text-slate-400 mt-0.5">{subjName}</div>}
                              {timeRange && (
                                <div className="mt-1 flex items-center gap-0.5 text-[9px] text-slate-500">
                                  <Clock className="h-2.5 w-2.5" />{timeRange}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Add slot modal ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <CalendarDays className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h2 className="text-sm font-semibold text-slate-50">Προσθήκη στο πρόγραμμα</h2>
              </div>
              <button type="button" onClick={closeAddSlotModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
              </div>
            )}

            <div className="px-6 pb-2">
              <SlotFormFields
                classTitle={addForm.classId ? (classes.find((c) => c.id === addForm.classId)?.title ?? '') : ''}
                dayValue={addForm.day} isEdit={false} classId={addForm.classId}
                subjectId={addForm.subjectId} onSubjectChange={handleAddFieldChange('subjectId')}
                tutorId={addForm.tutorId} onTutorChange={handleAddFieldChange('tutorId')}
                startTime={addForm.startTime} onStartTimeChange={handleAddTimeChange('startTime')}
                startPeriod={addForm.startPeriod} onStartPeriodChange={handleAddFieldChange('startPeriod')}
                endTime={addForm.endTime} onEndTimeChange={handleAddTimeChange('endTime')}
                endPeriod={addForm.endPeriod} onEndPeriodChange={handleAddFieldChange('endPeriod')}
                startDate={addForm.startDate} onStartDateChange={(v) => setAddForm((p) => ({ ...p, startDate: v }))}
                endDate={addForm.endDate} onEndDateChange={(v) => setAddForm((p) => ({ ...p, endDate: v }))}
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4">
              <button type="button" onClick={closeAddSlotModal}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60">
                Ακύρωση
              </button>
              <button type="button" onClick={handleConfirmAddSlot} disabled={savingSlot}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                {savingSlot ? <><Loader2 className="h-3 w-3 animate-spin" />Προσθήκη…</> : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit slot modal ── */}
      {editModalOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <CalendarDays className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-50">Επεξεργασία στο πρόγραμμα</h2>
                  {currentEditClass && <p className="text-[11px] text-slate-400 mt-0.5">{currentEditClass.title}</p>}
                </div>
              </div>
              <button type="button" onClick={closeEditSlotModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
              </div>
            )}

            <div className="px-6 pb-2">
              <SlotFormFields
                classTitle={currentEditClass?.title ?? ''} dayValue={editForm.day}
                onDayChange={handleEditFieldChange('day')} isEdit={true} classId={editForm.classId}
                subjectId={editForm.subjectId} onSubjectChange={handleEditFieldChange('subjectId')}
                tutorId={editForm.tutorId} onTutorChange={handleEditFieldChange('tutorId')}
                startTime={editForm.startTime} onStartTimeChange={handleEditTimeChange('startTime')}
                startPeriod={editForm.startPeriod} onStartPeriodChange={handleEditFieldChange('startPeriod')}
                endTime={editForm.endTime} onEndTimeChange={handleEditTimeChange('endTime')}
                endPeriod={editForm.endPeriod} onEndPeriodChange={handleEditFieldChange('endPeriod')}
                startDate={editForm.startDate} onStartDateChange={(v) => setEditForm((p) => p ? { ...p, startDate: v } : p)}
                endDate={editForm.endDate} onEndDateChange={(v) => setEditForm((p) => p ? { ...p, endDate: v } : p)}
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4">
              <button type="button" onClick={closeEditSlotModal} disabled={savingEdit}
                className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
                Ακύρωση
              </button>
              <button type="button" onClick={handleConfirmEditSlot} disabled={savingEdit}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                {savingEdit ? <><Loader2 className="h-3 w-3 animate-spin" />Ενημέρωση…</> : 'Ενημέρωση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete slot modal ── */}
      {deleteSlotTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <CalendarDays className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Διαγραφή από το πρόγραμμα</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Αφαίρεση του τμήματος{' '}
                <span className="font-semibold text-slate-100">«{deleteSlotTarget.classLabel}»</span>{' '}
                από την ημέρα{' '}
                <span className="font-semibold text-slate-100">{deleteSlotTarget.dayLabel}</span>
                {deleteSlotTarget.timeRange && <> στις <span className="font-semibold text-slate-100">{deleteSlotTarget.timeRange}</span></>};
                {' '}Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deletingSlot) setDeleteSlotTarget(null); }} disabled={deletingSlot}
                  className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
                  Ακύρωση
                </button>
                <button type="button" onClick={handleConfirmDeleteSlot} disabled={deletingSlot}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deletingSlot ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}