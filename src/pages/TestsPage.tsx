// src/pages/TestsPage.tsx
import {
  useEffect, useMemo, useState,
  type ChangeEvent, type FormEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import AppDatePicker from '../components/ui/AppDatePicker';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import {
  ArrowRight, ArrowLeft, Loader2, Search, ClipboardList,
  Users, Percent, Clock, Calendar, BookOpen, X, Tag,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type ClassRow = { id: string; school_id: string; title: string; subject_id: string | null };
type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null };
type LevelRow = { id: string; school_id: string; name: string };
type ClassSubjectRow = { class_id: string; subject_id: string; school_id?: string | null };
type TestRow = { id: string; school_id: string; class_id: string; subject_id: string; test_date: string; start_time: string | null; end_time: string | null; title: string | null; description: string | null };
type AddTestForm = { classId: string | null; subjectId: string | null; date: string; startTime: string; startPeriod: 'AM' | 'PM'; endTime: string; endPeriod: 'AM' | 'PM'; title: string };
type EditTestForm = AddTestForm & { id: string };
type StudentRow = { id: string; school_id: string; full_name: string | null };
type TestResultRow = { id: string; test_id: string; student_id: string; grade: number | null };
type TestResultsModalState = { testId: string; testTitle: string | null; dateDisplay: string; timeRange: string; classTitle: string; subjectName: string };
type GradeInfo = { grade: string; existingResultId?: string };

const emptyForm: AddTestForm = { classId: null, subjectId: null, date: '', startTime: '', startPeriod: 'PM', endTime: '', endPeriod: 'PM', title: '' };
const pad2 = (n: number) => n.toString().padStart(2, '0');

function convert12To24(time: string, period: 'AM' | 'PM'): string | null {
  const t = time.trim(); if (!t) return null;
  const [hStr, mStr = '00'] = t.split(':'); let h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  h = h % 12; if (period === 'PM') h += 12; else if (period === 'AM' && h === 12) h = 0;
  return `${pad2(h)}:${pad2(m)}`;
}
function convert24To12(time: string | null): { time: string; period: 'AM' | 'PM' } {
  if (!time) return { time: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':'); let h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { time: '', period: 'AM' };
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
  return { time: `${pad2(h)}:${pad2(m)}`, period };
}
function formatTimeInput(raw: string): string { const digits = raw.replace(/\D/g, '').slice(0, 4); if (digits.length <= 2) return digits; return `${digits.slice(0, 2)}:${digits.slice(2)}`; }
function formatDateDisplay(iso: string | null): string { if (!iso) return ''; const [y, m, d] = iso.split('-'); if (!y || !m || !d) return iso; return `${d}/${m}/${y}`; }
function parseDateDisplayToISO(display: string): string | null { const v = display.trim(); if (!v) return null; const parts = v.split(/[\/\-\.]/); if (parts.length !== 3) return null; const [dStr, mStr, yStr] = parts; const day = Number(dStr), month = Number(mStr), year = Number(yStr); if (!day || !month || !year) return null; return `${year}-${pad2(month)}-${pad2(day)}`; }
function formatTimeDisplay(t: string | null): string { if (!t) return ''; return t.slice(0, 5); }

// ── Page ────────────────────────────────────────────────────────────────────
export default function TestsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  // ── Dynamic classes ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
  const selectCls = inputCls;

  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';
  const theadRowCls = isDark ? 'border-b border-slate-700/60 bg-slate-900/40' : 'border-b border-slate-200 bg-slate-50';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';
  const timeBadgeCls = isDark
    ? 'inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300'
    : 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600';
  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3';
  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/30 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';
  const paginationPageCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-900/20 px-3 py-1 text-[11px] text-slate-300'
    : 'rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600';
  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';
  const emptyTitleCls = isDark ? 'text-sm font-medium text-slate-200' : 'text-sm font-medium text-slate-700';
  const emptySubCls = isDark ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-slate-400';
  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';
  const modalCardCls = isDark
    ? 'relative w-full overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';
  const modalSmCardCls = isDark
    ? 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';
  const modalTitleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';
  const modalSubtitleCls = isDark ? 'mt-0.5 text-[11px] text-slate-400' : 'mt-0.5 text-[11px] text-slate-500';
  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';
  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';
  const labelCls = `flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const timeInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-3 pr-16 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-16 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
  const periodSelectCls = isDark
    ? 'absolute inset-y-1 right-1 rounded-md border border-slate-600/60 bg-slate-800/80 px-1.5 text-[10px] text-slate-300 outline-none'
    : 'absolute inset-y-1 right-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[10px] text-slate-700 outline-none';
  const resultsColCls = isDark
    ? 'overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/30'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-slate-50';
  const resultsColHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/70 px-3 py-2.5'
    : 'flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2.5';
  const resultsSearchBoxCls = isDark
    ? 'flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1'
    : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1';
  const resultsSearchInputCls = isDark
    ? 'w-24 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-600'
    : 'w-24 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400';
  const resultsDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const resultsRowHoverCls = isDark ? 'flex items-center justify-between px-3 py-2 hover:bg-white/[0.02]' : 'flex items-center justify-between px-3 py-2 hover:bg-slate-100/60';
  const resultsRowHoverAssignedCls = isDark ? 'flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02]' : 'flex items-center gap-2 px-3 py-2 hover:bg-slate-100/60';
  const gradeInputCls = isDark
    ? 'h-7 w-20 shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'h-7 w-20 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]';
  const avgBoxCls = isDark
    ? 'flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3'
    : 'flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

  // ── Inline components (need isDark from closure) ──

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

  const ModalShell = ({ title, subtitle, icon, onClose, children, wide }: { title: string; subtitle?: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${modalCardCls} ${wide ? 'max-w-4xl' : 'max-w-md'}`} style={{ background: 'var(--color-sidebar)' }}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>{icon}</div>
            <div>
              <h2 className={modalTitleCls}>{title}</h2>
              {subtitle && <p className={modalSubtitleCls}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className={modalCloseBtnCls}><X className="h-3.5 w-3.5" /></button>
        </div>
        {children}
      </div>
    </div>
  );

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AddTestForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditTestForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; dateDisplay: string; timeRange: string; classTitle: string; subjectName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [searchTerm]);

  const [resultsModal, setResultsModal] = useState<TestResultsModalState | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSaving, setResultsSaving] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsAllStudents, setResultsAllStudents] = useState<StudentRow[]>([]);
  const [resultsAssignedIds, setResultsAssignedIds] = useState<Set<string>>(new Set());
  const [resultsInitialAssignedIds, setResultsInitialAssignedIds] = useState<Set<string>>(new Set());
  const [resultsGradeByStudent, setResultsGradeByStudent] = useState<Record<string, GradeInfo>>({});
  const [resultsSearchLeft, setResultsSearchLeft] = useState('');
  const [resultsSearchRight, setResultsSearchRight] = useState('');

  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);
  const classById = useMemo(() => { const m = new Map<string, ClassRow>(); classes.forEach((c) => m.set(c.id, c)); return m; }, [classes]);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [{ data: classData, error: classErr }, { data: subjData, error: subjErr }, { data: levelData, error: lvlErr }, { data: classSubjectData, error: classSubjErr }, { data: testsData, error: testsErr }] = await Promise.all([
          supabase.from('classes').select('id, school_id, title, subject_id').eq('school_id', schoolId).order('title', { ascending: true }),
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('levels').select('id, school_id, name').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('class_subjects').select('class_id, subject_id, school_id').eq('school_id', schoolId),
          supabase.from('tests').select('id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description').eq('school_id', schoolId).order('test_date', { ascending: true }).order('start_time', { ascending: true }),
        ]);
        if (classErr) throw classErr; if (subjErr) throw subjErr; if (lvlErr) throw lvlErr; if (classSubjErr) throw classSubjErr; if (testsErr) throw testsErr;
        setClasses((classData ?? []) as ClassRow[]); setSubjects((subjData ?? []) as SubjectRow[]); setLevels((levelData ?? []) as LevelRow[]); setClassSubjects((classSubjectData ?? []) as ClassSubjectRow[]); setTests((testsData ?? []) as TestRow[]);
      } catch (err) { console.error(err); setError('Αποτυχία φόρτωσης διαγωνισμάτων.'); }
      finally { setLoading(false); }
    };
    load();
  }, [schoolId]);

  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId) ?? null;
    const attachedIds = new Set<string>();
    classSubjects.filter((cs) => cs.class_id === classId && cs.subject_id).forEach((cs) => attachedIds.add(cs.subject_id));
    if (cls?.subject_id) attachedIds.add(cls.subject_id);
    const attachedSubjects: SubjectRow[] = []; attachedIds.forEach((id) => { const s = subjectById.get(id); if (s) attachedSubjects.push(s); });
    if (attachedSubjects.length >= 2) return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    let levelId: string | null = null;
    if (cls?.subject_id) { const mainSubj = subjectById.get(cls.subject_id); levelId = mainSubj?.level_id ?? null; }
    const extraSubjects = levelId ? subjects.filter((s) => s.level_id === levelId) : subjects;
    const merged = new Map<string, SubjectRow>(); extraSubjects.forEach((s) => merged.set(s.id, s)); attachedSubjects.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
  };

  const testsWithDisplay = useMemo(() => tests.map((t) => {
    const cls = classById.get(t.class_id); const subj = subjectById.get(t.subject_id);
    const timeRange = t.start_time && t.end_time ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}` : '';
    return { ...t, classTitle: cls?.title ?? '—', subjectName: subj?.name ?? '—', dateDisplay: formatDateDisplay(t.test_date), timeRange };
  }), [tests, classById, subjectById]);

  const filteredTests = useMemo(() => { const q = searchTerm.trim().toLowerCase(); if (!q) return testsWithDisplay; return testsWithDisplay.filter((t) => [t.dateDisplay, t.timeRange, t.classTitle, t.subjectName, t.title ?? ''].some((v) => v.toLowerCase().includes(q))); }, [testsWithDisplay, searchTerm]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredTests.length / pageSize)), [filteredTests.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedTests = useMemo(() => { const start = (page - 1) * pageSize; return filteredTests.slice(start, start + pageSize); }, [filteredTests, page]);
  const showingFrom = filteredTests.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredTests.length);

  const openModal = () => { setError(null); setForm(emptyForm); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); };

  const handleFieldChange = (field: keyof AddTestForm) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => { if (field === 'classId') return { ...prev, classId: value || null, subjectId: null }; if (field === 'subjectId') return { ...prev, subjectId: value || null }; return { ...prev, [field]: value as any }; });
  };
  const handleTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [field]: formatTimeInput(e.target.value) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    if (!form.classId) { setError('Επιλέξτε τμήμα.'); return; }
    const subOpts = getSubjectsForClass(form.classId); if (subOpts.length > 0 && !form.subjectId) { setError('Επιλέξτε μάθημα.'); return; }
    if (!form.date) { setError('Επιλέξτε ημερομηνία.'); return; }
    const testDateISO = parseDateDisplayToISO(form.date); if (!testDateISO) { setError('Μη έγκυρη ημερομηνία.'); return; }
    if (!form.startTime || !form.endTime) { setError('Συμπληρώστε ώρες.'); return; }
    const start24 = convert12To24(form.startTime, form.startPeriod); const end24 = convert12To24(form.endTime, form.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες.'); return; }
    setSaving(true); setError(null);
    const { data, error: insertErr } = await supabase.from('tests').insert({ school_id: schoolId, class_id: form.classId, subject_id: form.subjectId ?? subOpts[0]?.id, test_date: testDateISO, start_time: start24, end_time: end24, title: form.title || null, description: null }).select('*').maybeSingle();
    setSaving(false);
    if (insertErr || !data) { setError('Αποτυχία δημιουργίας διαγωνίσματος.'); return; }
    setTests((prev) => [...prev, data as TestRow]); setModalOpen(false);
  };

  const openEditModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId); if (!t) return;
    const { time: startTime, period: startPeriod } = convert24To12(t.start_time);
    const { time: endTime, period: endPeriod } = convert24To12(t.end_time);
    setError(null); setEditForm({ id: t.id, classId: t.class_id, subjectId: t.subject_id ?? null, date: formatDateDisplay(t.test_date), startTime, startPeriod, endTime, endPeriod, title: t.title ?? '' }); setEditModalOpen(true);
  };
  const closeEditModal = () => { if (savingEdit) return; setEditModalOpen(false); setEditForm(null); };
  const handleEditFieldChange = (field: keyof EditTestForm) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setEditForm((prev) => { if (!prev) return prev; if (field === 'classId') return { ...prev, classId: value || null, subjectId: null }; if (field === 'subjectId') return { ...prev, subjectId: value || null }; return { ...prev, [field]: value as any }; });
  };
  const handleEditTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) => setEditForm((prev) => prev ? { ...prev, [field]: formatTimeInput(e.target.value) } : prev);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault(); if (!schoolId || !editForm) return;
    if (!editForm.classId) { setError('Επιλέξτε τμήμα.'); return; }
    const subOpts = getSubjectsForClass(editForm.classId); if (subOpts.length > 0 && !editForm.subjectId) { setError('Επιλέξτε μάθημα.'); return; }
    const testDateISO = parseDateDisplayToISO(editForm.date); if (!testDateISO) { setError('Μη έγκυρη ημερομηνία.'); return; }
    if (!editForm.startTime || !editForm.endTime) { setError('Συμπληρώστε ώρες.'); return; }
    const start24 = convert12To24(editForm.startTime, editForm.startPeriod); const end24 = convert12To24(editForm.endTime, editForm.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες.'); return; }
    setSavingEdit(true); setError(null);
    const { data, error: updateErr } = await supabase.from('tests').update({ class_id: editForm.classId, subject_id: editForm.subjectId ?? subOpts[0]?.id, test_date: testDateISO, start_time: start24, end_time: end24, title: editForm.title || null }).eq('id', editForm.id).select('*').maybeSingle();
    setSavingEdit(false);
    if (updateErr || !data) { setError('Αποτυχία ενημέρωσης.'); return; }
    setTests((prev) => prev.map((t) => (t.id === editForm.id ? (data as TestRow) : t))); closeEditModal();
  };

  const openDeleteModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId); if (!t) return;
    const cls = classById.get(t.class_id); const subj = subjectById.get(t.subject_id);
    setDeleteTarget({ id: t.id, dateDisplay: formatDateDisplay(t.test_date), timeRange: t.start_time && t.end_time ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}` : '', classTitle: cls?.title ?? '—', subjectName: subj?.name ?? '—' });
  };
  const closeDeleteModal = () => { if (deleting) return; setDeleteTarget(null); };
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return; setDeleting(true); setError(null);
    const { error: deleteErr } = await supabase.from('tests').delete().eq('id', deleteTarget.id);
    setDeleting(false); if (deleteErr) { setError('Αποτυχία διαγραφής.'); return; }
    setTests((prev) => prev.filter((t) => t.id !== deleteTarget.id)); setDeleteTarget(null);
  };

  const availableStudents = useMemo(() => resultsAllStudents.filter((s) => !resultsAssignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(resultsSearchLeft.toLowerCase())), [resultsAllStudents, resultsAssignedIds, resultsSearchLeft]);
  const assignedStudents = useMemo(() => resultsAllStudents.filter((s) => resultsAssignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(resultsSearchRight.toLowerCase())), [resultsAllStudents, resultsAssignedIds, resultsSearchRight]);

  const openResultsModal = async (testId: string) => {
    if (!schoolId) return;
    const tDisplay = testsWithDisplay.find((tt) => tt.id === testId); if (!tDisplay) return;
    setResultsError(null); setResultsModal({ testId, testTitle: tDisplay.title ?? null, dateDisplay: tDisplay.dateDisplay, timeRange: tDisplay.timeRange, classTitle: tDisplay.classTitle, subjectName: tDisplay.subjectName });
    setResultsLoading(true);
    try {
      const { data: studentsData, error: studentsErr } = await supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true });
      if (studentsErr) throw studentsErr;
      const studentsList = (studentsData ?? []) as StudentRow[]; setResultsAllStudents(studentsList);
      const { data: resultsData, error: resultsErr } = await supabase.from('test_results').select('id, test_id, student_id, grade').eq('test_id', testId);
      if (resultsErr) throw resultsErr;
      const assignedIds = new Set<string>(); const gradeMap: Record<string, GradeInfo> = {};
      (resultsData ?? []).forEach((raw) => { const r = raw as TestResultRow; assignedIds.add(r.student_id); gradeMap[r.student_id] = { grade: r.grade !== null ? String(r.grade) : '', existingResultId: r.id }; });
      studentsList.forEach((s) => { if (!gradeMap[s.id]) gradeMap[s.id] = { grade: '', existingResultId: undefined }; });
      setResultsAssignedIds(assignedIds); setResultsInitialAssignedIds(new Set(assignedIds)); setResultsGradeByStudent(gradeMap); setResultsSearchLeft(''); setResultsSearchRight('');
    } catch (err) { console.error(err); setResultsError('Αποτυχία φόρτωσης.'); setResultsAllStudents([]); setResultsAssignedIds(new Set()); setResultsInitialAssignedIds(new Set()); setResultsGradeByStudent({}); }
    finally { setResultsLoading(false); }
  };

  const closeResultsModal = () => { if (resultsSaving) return; setResultsModal(null); setResultsError(null); setResultsLoading(false); setResultsAllStudents([]); setResultsAssignedIds(new Set()); setResultsInitialAssignedIds(new Set()); setResultsGradeByStudent({}); setResultsSearchLeft(''); setResultsSearchRight(''); };

  const handleSaveResults = async () => {
    if (!resultsModal) return;
    for (const studentId of resultsAssignedIds) {
      const info = resultsGradeByStudent[studentId]; const gradeTrim = (info?.grade ?? '').trim();
      if (!gradeTrim) { const st = resultsAllStudents.find((s) => s.id === studentId); setResultsError(`Συμπληρώστε βαθμό για τον μαθητή "${st?.full_name ?? 'Άγνωστος'}".`); return; }
      if (Number.isNaN(Number(gradeTrim.replace(',', '.')))) { const st = resultsAllStudents.find((s) => s.id === studentId); setResultsError(`Μη έγκυρος βαθμός για "${st?.full_name ?? 'Άγνωστος'}".`); return; }
    }
    setResultsSaving(true); setResultsError(null);
    try {
      const inserts: { test_id: string; student_id: string; grade: number }[] = [];
      const updates: { id: string; grade: number }[] = [];
      const deleteIds: string[] = [];
      for (const studentId of resultsAssignedIds) {
        const info = resultsGradeByStudent[studentId]; const gradeNum = Number((info?.grade ?? '').trim().replace(',', '.'));
        if (resultsInitialAssignedIds.has(studentId)) { if (info?.existingResultId) updates.push({ id: info.existingResultId, grade: gradeNum }); }
        else inserts.push({ test_id: resultsModal.testId, student_id: studentId, grade: gradeNum });
      }
      for (const studentId of resultsInitialAssignedIds) { if (!resultsAssignedIds.has(studentId)) { const info = resultsGradeByStudent[studentId]; if (info?.existingResultId) deleteIds.push(info.existingResultId); } }
      if (inserts.length > 0) { const { error: insertErr } = await supabase.from('test_results').insert(inserts); if (insertErr) throw insertErr; }
      for (const upd of updates) { const { error: updateErr } = await supabase.from('test_results').update({ grade: upd.grade }).eq('id', upd.id); if (updateErr) throw updateErr; }
      if (deleteIds.length > 0) { const { error: delErr } = await supabase.from('test_results').delete().in('id', deleteIds); if (delErr) throw delErr; }
      closeResultsModal();
    } catch (err) { console.error(err); setResultsError('Αποτυχία αποθήκευσης βαθμών.'); }
    finally { setResultsSaving(false); }
  };

  const TestFormFields = ({ f, onField, onTimeChange, isEdit }: {
    f: AddTestForm; onField: (field: any) => (e: ChangeEvent<any>) => void;
    onTimeChange: (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) => void;
    isEdit?: boolean;
  }) => {
    const subOpts = getSubjectsForClass(f.classId);
    return (
      <div className="space-y-4">
        <FormField label="Τμήμα *" icon={<BookOpen className="h-3 w-3" />}>
          <select className={selectCls} value={f.classId ?? ''} onChange={onField('classId')} required>
            <option value="">Επιλέξτε τμήμα</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </FormField>
        <FormField label="Μάθημα *" icon={<Tag className="h-3 w-3" />} hint={subOpts.length === 0 && f.classId ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
          <select className={selectCls} value={f.subjectId ?? ''} onChange={onField('subjectId')} disabled={subOpts.length === 0 || !f.classId}>
            <option value="">{subOpts.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
            {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Ημερομηνία *" icon={<Calendar className="h-3 w-3" />}>
          <AppDatePicker value={f.date} onChange={(v) => onField('date')({ target: { value: v } } as any)} placeholder="π.χ. 12/05/2025" />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <TimeField label="Ώρα έναρξης *" value={f.startTime} onChange={onTimeChange('startTime')} period={f.startPeriod} onPeriod={(p) => onField('startPeriod')({ target: { value: p } } as any)} />
          <TimeField label="Ώρα λήξης *" value={f.endTime} onChange={onTimeChange('endTime')} period={f.endPeriod} onPeriod={(p) => onField('endPeriod')({ target: { value: p } } as any)} />
        </div>
        <FormField label="Τίτλος (προαιρετικό)" icon={<Tag className="h-3 w-3" />}>
          <input className={inputCls} placeholder="π.χ. Διαγώνισμα Κεφαλαίου 3" value={f.title} onChange={onField('title')} />
        </FormField>
      </div>
    );
  };

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <ClipboardList className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγωνίσματα</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Καταχώρησε διαγωνίσματα ανά τμήμα και μάθημα.</p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <ClipboardList className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />{tests.length} σύνολο
                </span>
                {searchTerm.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]" style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Search className="h-3 w-3" />{filteredTests.length} αποτελέσματα
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button type="button" onClick={openModal} className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <ClipboardList className="h-3.5 w-3.5" />Προσθήκη διαγωνίσματος
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}</div>}
      {!schoolId && <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.</div>}

      {/* Table card */}
      <div className={tableCardCls}>
        {loading ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>{[...Array(4)].map((_, i) => <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse"><div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} /><div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} /><div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} /><div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} /></div>)}</div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"><div className={emptyBoxCls}><ClipboardList className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /></div><div><p className={emptyTitleCls}>Δεν υπάρχουν ακόμη διαγωνίσματα</p><p className={emptySubCls}>Πατήστε «Προσθήκη διαγωνίσματος».</p></div></div>
        ) : filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"><div className={emptyBoxCls}><Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /></div><div><p className={emptyTitleCls}>Δεν βρέθηκαν διαγωνίσματα</p><p className={emptySubCls}>Δοκιμάστε διαφορετικά κριτήρια.</p></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[{ icon: <Calendar className="h-3 w-3" />, label: 'ΗΜΕΡΟΜΗΝΙΑ' }, { icon: <Clock className="h-3 w-3" />, label: 'ΩΡΑ' }, { icon: <BookOpen className="h-3 w-3" />, label: 'ΤΜΗΜΑ' }, { icon: <Tag className="h-3 w-3" />, label: 'ΜΑΘΗΜΑ' }, { icon: <ClipboardList className="h-3 w-3" />, label: 'ΤΙΤΛΟΣ' }].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5"><span className="opacity-60">{icon}</span>{label}</span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedTests.map((t) => (
                  <tr key={t.id} className={trHoverCls}>
                    <td className={`px-5 py-3.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.dateDisplay}</td>
                    <td className="px-5 py-3.5">
                      {t.timeRange ? <span className={timeBadgeCls}>{t.timeRange}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                    </td>
                    <td className={`px-5 py-3.5 font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{t.classTitle}</td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subjectName}</td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.title ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openResultsModal(t.id)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-400 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-300"
                          title="Μαθητές & βαθμοί">
                          <Users className="h-3.5 w-3.5" /><Percent className="h-3 w-3" />
                        </button>
                        <EditDeleteButtons onEdit={() => openEditModal(t.id)} onDelete={() => openDeleteModal(t.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredTests.length > 0 && (
          <div className={paginationBarCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span> από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{filteredTests.length}</span> διαγωνίσματα
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}><ChevronLeft className="h-3.5 w-3.5" /></button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add modal ── */}
      {modalOpen && (
        <ModalShell title="Νέο διαγώνισμα" icon={<ClipboardList className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} onClose={closeModal}>
          {error && <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="max-h-[60vh] overflow-y-auto px-6 pb-2"><TestFormFields f={form} onField={handleFieldChange} onTimeChange={handleTimeChange} /></div>
            <div className={modalFooterCls}>
              <button type="button" onClick={closeModal} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
              <button type="submit" disabled={saving} className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ── Edit modal ── */}
      {editModalOpen && editForm && (
        <ModalShell title="Επεξεργασία διαγωνίσματος" icon={<ClipboardList className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} onClose={closeEditModal}>
          {error && <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}</div>}
          <form onSubmit={handleEditSubmit}>
            <div className="max-h-[60vh] overflow-y-auto px-6 pb-2"><TestFormFields f={editForm} onField={handleEditFieldChange} onTimeChange={handleEditTimeChange} isEdit /></div>
            <div className={modalFooterCls}>
              <button type="button" onClick={closeEditModal} disabled={savingEdit} className={cancelBtnCls}>Ακύρωση</button>
              <button type="submit" disabled={savingEdit} className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {savingEdit ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Ενημέρωση'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={modalSmCardCls} style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30"><ClipboardList className="h-5 w-5 text-red-400" /></div>
              <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγραφή διαγωνίσματος</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλετε να διαγράψετε το διαγώνισμα <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.subjectName}»</span> για το τμήμα <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{deleteTarget.classTitle}</span> στις <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{deleteTarget.dateDisplay}</span>{deleteTarget.timeRange && <> ({deleteTarget.timeRange})</>}; Δεν μπορεί να αναιρεθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={closeDeleteModal} disabled={deleting} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleConfirmDelete} disabled={deleting} className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">{deleting ? 'Διαγραφή…' : 'Διαγραφή'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Results modal ── */}
      {resultsModal && (
        <ModalShell title="Μαθητές & βαθμοί" subtitle={`${resultsModal.subjectName} · ${resultsModal.classTitle}${resultsModal.dateDisplay ? ` · ${resultsModal.dateDisplay}` : ''}${resultsModal.timeRange ? ` · ${resultsModal.timeRange}` : ''}`} icon={<Users className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} onClose={closeResultsModal} wide>
          {resultsError && <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{resultsError}</div>}
          <div className="px-6 pb-2">
            {resultsLoading ? (
              <div className={`flex items-center justify-center py-10 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Φόρτωση μαθητών και βαθμών...</div>
            ) : resultsAllStudents.length === 0 ? (
              <p className={`py-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δεν βρέθηκαν μαθητές. Προσθέστε μαθητές στη σελίδα «Μαθητές».</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Left: available */}
                <div className={resultsColCls}>
                  <div className={resultsColHeaderCls}>
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Όλοι οι μαθητές</span>
                    <div className={resultsSearchBoxCls}>
                      <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input className={resultsSearchInputCls} placeholder="Αναζήτηση..." value={resultsSearchLeft} onChange={(e) => setResultsSearchLeft(e.target.value)} disabled={resultsSaving} />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {availableStudents.length === 0
                      ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
                      : <div className={resultsDivideCls}>{availableStudents.map((s) => (
                        <div key={s.id} className={resultsRowHoverCls}>
                          <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
                          <button type="button" onClick={() => setResultsAssignedIds((prev) => { const n = new Set(prev); n.add(s.id); return n; })} disabled={resultsSaving}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60">
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      ))}</div>}
                  </div>
                </div>
                {/* Right: assigned */}
                <div className={resultsColCls}>
                  <div className={resultsColHeaderCls}>
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Μαθητές που έγραψαν</span>
                    <div className={resultsSearchBoxCls}>
                      <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input className={resultsSearchInputCls} placeholder="Αναζήτηση..." value={resultsSearchRight} onChange={(e) => setResultsSearchRight(e.target.value)} disabled={resultsSaving} />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {assignedStudents.length === 0
                      ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές.</p>
                      : <div className={resultsDivideCls}>{assignedStudents.map((s) => {
                        const info = resultsGradeByStudent[s.id] ?? { grade: '' };
                        return (
                          <div key={s.id} className={resultsRowHoverAssignedCls}>
                            <button type="button" onClick={() => setResultsAssignedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; })} disabled={resultsSaving}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 disabled:opacity-60">
                              <ArrowLeft size={13} />
                            </button>
                            <span className={`flex-1 text-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
                            <input type="text" inputMode="decimal" placeholder="π.χ. 18.5" value={info.grade}
                              onChange={(e) => setResultsGradeByStudent((prev) => ({ ...prev, [s.id]: { grade: e.target.value, existingResultId: prev[s.id]?.existingResultId } }))}
                              className={gradeInputCls} disabled={resultsSaving} />
                          </div>
                        );
                      })}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className={modalFooterCls}>
            <button type="button" onClick={closeResultsModal} disabled={resultsSaving} className={cancelBtnCls}>Ακύρωση</button>
            <button type="button" onClick={handleSaveResults} disabled={resultsSaving || resultsLoading} className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {resultsSaving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}