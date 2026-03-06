// src/pages/StudentsPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import {
  Users, Search, UserPlus, ChevronLeft, ChevronRight,
  User, Phone, Mail, Calendar, FileText, Lock, Loader2,
  X, Info, GraduationCap, Layers, UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import DatePickerField from '../components/ui/AppDatePicker';

type LevelRow = { id: string; school_id: string; name: string; created_at: string };
type StudentRow = {
  id: string; school_id: string; full_name: string;
  date_of_birth: string | null; phone: string | null; email: string | null;
  special_notes: string | null; level_id: string | null;
  father_name: string | null; father_date_of_birth: string | null;
  father_phone: string | null; father_email: string | null;
  mother_name: string | null; mother_date_of_birth: string | null;
  mother_phone: string | null; mother_email: string | null;
  created_at: string;
};

const STUDENT_SELECT = `
  id, school_id, full_name, date_of_birth, phone, email, special_notes, level_id,
  father_name, father_date_of_birth, father_phone, father_email,
  mother_name, mother_date_of_birth, mother_phone, mother_email,
  created_at
`;

function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
}
function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

type ModalMode = 'create' | 'edit';
type TabKey = 'student' | 'parents';
const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ── Reusable field components ──────────────────────────────────────────────

function FormField({ label, icon, hint, children, isDark }: {
  label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode; isDark: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
}

function InfoField({ label, value, isDark }: { label: string; value: string | null | undefined; isDark: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`mt-0.5 text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{value?.trim() ? value : '—'}</div>
    </div>
  );
}

function InfoDateField({ label, iso, isDark }: { label: string; iso: string | null; isDark: boolean }) {
  return <InfoField label={label} value={iso ? formatDateToGreek(iso) : '—'} isDark={isDark} />;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const studentsCacheKey = schoolId ? `pt_students_cache_v1_${schoolId}` : '';
  const levelsCacheKey = schoolId ? `pt_levels_cache_v1_${schoolId}` : '';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<TabKey>('student');

  const [infoStudent, setInfoStudent] = useState<StudentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [levelId, setLevelId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherDob, setFatherDob] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherDob, setMotherDob] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');

  const [search, setSearch] = useState('');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const studentsReqRef = useRef(0);
  const levelsReqRef = useRef(0);

  useEffect(() => { setPage(1); }, [search]);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  useEffect(() => {
    setError(null);
    if (!schoolId) { setStudents([]); setLevels([]); setLoading(false); return; }
    hintHydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const hintHydrate = () => {
    if (!schoolId) return;
    const cachedStudents = safeParseJSON<StudentRow[]>(sessionStorage.getItem(studentsCacheKey));
    const cachedLevels = safeParseJSON<LevelRow[]>(sessionStorage.getItem(levelsCacheKey));
    if (cachedStudents?.length) { setStudents(cachedStudents); setLoading(false); } else { setLoading(true); }
    if (cachedLevels) setLevels(cachedLevels);
  };

  const loadLevels = useCallback(async (opts?: { silent?: boolean }) => {
    if (!schoolId) return;
    const reqId = ++levelsReqRef.current;
    if (opts?.silent) setRefreshing(true);
    setError(null);
    try {
      const res = await withTimeout(supabase.from('levels').select('id, school_id, name, created_at').eq('school_id', schoolId).order('name', { ascending: true }), FETCH_TIMEOUT_MS);
      if (reqId !== levelsReqRef.current) return;
      const dbError = (res as any).error; const data = (res as any).data as LevelRow[] | null;
      if (dbError) { console.error(dbError); setError('Αποτυχία φόρτωσης επιπέδων.'); return; }
      const next = (data ?? []) as LevelRow[];
      setLevels(next); sessionStorage.setItem(levelsCacheKey, JSON.stringify(next));
    } catch (e) { console.error(e); if (reqId !== levelsReqRef.current) return; setError('Αποτυχία φόρτωσης επιπέδων.'); }
    finally { if (reqId === levelsReqRef.current && opts?.silent) setRefreshing(false); }
  }, [schoolId, levelsCacheKey]);

  const loadStudents = useCallback(async (opts?: { silent?: boolean }) => {
    if (!schoolId) { setLoading(false); return; }
    const reqId = ++studentsReqRef.current;
    if (opts?.silent) setRefreshing(true); else setLoading(students.length === 0);
    setError(null);
    try {
      const res = await withTimeout(supabase.from('students').select(STUDENT_SELECT).eq('school_id', schoolId).order('full_name', { ascending: true }), FETCH_TIMEOUT_MS);
      if (reqId !== studentsReqRef.current) return;
      const dbError = (res as any).error; const data = (res as any).data as StudentRow[] | null;
      if (dbError) { console.error(dbError); setError('Αποτυχία φόρτωσης μαθητών.'); return; }
      const next = (data ?? []) as StudentRow[];
      setStudents(next); sessionStorage.setItem(studentsCacheKey, JSON.stringify(next));
    } catch (e) { console.error(e); if (reqId !== studentsReqRef.current) return; setError('Αποτυχία φόρτωσης μαθητών.'); }
    finally { if (reqId === studentsReqRef.current) { if (opts?.silent) setRefreshing(false); setLoading(false); } }
  }, [schoolId, studentsCacheKey, students.length]);

  useEffect(() => {
    if (!schoolId) return;
    loadLevels({ silent: true }); loadStudents({ silent: true });
  }, [schoolId, loadLevels, loadStudents]);

  useEffect(() => {
    if (!schoolId) return;
    const refetch = () => { hintHydrate(); loadStudents({ silent: true }); loadLevels({ silent: true }); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch(); };
    window.addEventListener('focus', refetch); window.addEventListener('online', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('focus', refetch); window.removeEventListener('online', refetch); document.removeEventListener('visibilitychange', onVisibility); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, loadStudents, loadLevels]);

  const resetForm = () => {
    setFullName(''); setDateOfBirth(''); setPhone(''); setEmail(''); setSpecialNotes(''); setLevelId('');
    setFatherName(''); setFatherDob(''); setFatherPhone(''); setFatherEmail('');
    setMotherName(''); setMotherDob(''); setMotherPhone(''); setMotherEmail('');
  };

  const openCreateModal = () => { resetForm(); setError(null); setModalMode('create'); setEditingStudent(null); setModalTab('student'); setModalOpen(true); setPassword(''); setNewPassword(''); };

  const openEditModal = (student: StudentRow) => {
    setError(null); setModalMode('edit'); setEditingStudent(student); setModalTab('student');
    setFullName(student.full_name ?? '');
    setDateOfBirth(student.date_of_birth ? isoToDisplay(student.date_of_birth) : '');
    setPhone(student.phone ?? ''); setEmail(student.email ?? '');
    setSpecialNotes(student.special_notes ?? ''); setLevelId(student.level_id ?? '');
    setFatherName(student.father_name ?? '');
    setFatherDob(student.father_date_of_birth ? isoToDisplay(student.father_date_of_birth) : '');
    setFatherPhone(student.father_phone ?? ''); setFatherEmail(student.father_email ?? '');
    setMotherName(student.mother_name ?? '');
    setMotherDob(student.mother_date_of_birth ? isoToDisplay(student.mother_date_of_birth) : '');
    setMotherPhone(student.mother_phone ?? ''); setMotherEmail(student.mother_email ?? '');
    setNewPassword(''); setModalOpen(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setModalOpen(false); setEditingStudent(null); setModalMode('create');
    setModalTab('student'); resetForm(); setPassword(''); setNewPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) return;
    setSaving(true); setError(null);
    const payload = {
      school_id: schoolId, full_name: nameTrimmed,
      date_of_birth: displayToIso(dateOfBirth) || null,
      phone: phone.trim() || null, email: email.trim() || null,
      special_notes: specialNotes.trim() || null, level_id: levelId || null,
      father_name: fatherName.trim() || null, father_date_of_birth: displayToIso(fatherDob) || null,
      father_phone: fatherPhone.trim() || null, father_email: fatherEmail.trim() || null,
      mother_name: motherName.trim() || null, mother_date_of_birth: displayToIso(motherDob) || null,
      mother_phone: motherPhone.trim() || null, mother_email: motherEmail.trim() || null,
    };
    try {
      if (modalMode === 'create') {
        if (password.trim().length < 6) { setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'); return; }
        if (!payload.email && !payload.phone) { setError('Βάλε Email ή Τηλέφωνο για να μπορεί να κάνει login στο mobile app.'); return; }
        const res = await supabase.from('students').insert(payload).select(STUDENT_SELECT);
        const dbError = (res as any).error; const data = (res as any).data as StudentRow[] | null;
        if (dbError || !data?.length) { console.error(dbError); setError('Αποτυχία δημιουργίας μαθητή.'); return; }
        const createdStudent = data[0] as StudentRow; const pwd = password;
        const nextList = [...students, createdStudent].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'));
        setStudents(nextList); sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
        closeModal(true);
        const { error: fnErr } = await supabase.functions.invoke('create-student-user', { body: { school_id: schoolId, student_id: createdStudent.id, email: payload.email, phone: payload.phone, password: pwd } });
        if (fnErr) console.error('create-student-user error:', fnErr);
      } else if (modalMode === 'edit' && editingStudent) {
        const res = await supabase.from('students').update({
          full_name: payload.full_name, date_of_birth: payload.date_of_birth,
          phone: payload.phone, email: payload.email, special_notes: payload.special_notes, level_id: payload.level_id,
          father_name: payload.father_name, father_date_of_birth: payload.father_date_of_birth,
          father_phone: payload.father_phone, father_email: payload.father_email,
          mother_name: payload.mother_name, mother_date_of_birth: payload.mother_date_of_birth,
          mother_phone: payload.mother_phone, mother_email: payload.mother_email,
        }).eq('id', editingStudent.id).eq('school_id', schoolId).select(STUDENT_SELECT);
        const dbError = (res as any).error; const data = (res as any).data as StudentRow[] | null;
        if (dbError || !data?.length) { console.error(dbError); setError('Αποτυχία ενημέρωσης μαθητή.'); return; }
        const updated = data[0] as StudentRow;
        const nextList = students.map((s) => (s.id === editingStudent.id ? updated : s));
        setStudents(nextList); sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
        const np = newPassword.trim();
        if (np) {
          if (np.length < 6) { setError('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'); }
          else {
            const { error: pwErr } = await supabase.functions.invoke('set-student-password', { body: { school_id: schoolId, student_id: editingStudent.id, new_password: np } });
            if (pwErr) console.error('set-student-password error:', pwErr);
          }
        }
        closeModal(true);
      }
    } finally { setSaving(false); }
  };

  const filteredStudents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return students;
    return students.filter((s) => {
      const levelName = s.level_id ? (levelNameById.get(s.level_id) ?? '') : '';
      const composite = [
        s.full_name, levelName, s.phone, s.email, s.special_notes,
        s.date_of_birth, s.date_of_birth ? formatDateToGreek(s.date_of_birth) : '',
        s.father_name, s.father_phone, s.father_email, s.father_date_of_birth,
        s.father_date_of_birth ? formatDateToGreek(s.father_date_of_birth) : '',
        s.mother_name, s.mother_phone, s.mother_email, s.mother_date_of_birth,
        s.mother_date_of_birth ? formatDateToGreek(s.mother_date_of_birth) : '',
      ].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [students, levelNameById, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredStudents.length / pageSize)), [filteredStudents.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedStudents = useMemo(() => { const start = (page - 1) * pageSize; return filteredStudents.slice(start, start + pageSize); }, [filteredStudents, page]);
  const showingFrom = filteredStudents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredStudents.length);

  // ── Style helpers ──────────────────────────────────────────────────────
  const cardCls = `overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'}`;
  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const theadRowCls = `border-b ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const tbodyDivideCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;
  const trHoverCls = `group transition-colors ${isDark ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}`;
  const modalBg = isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white';
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const paginationBtnCls = `inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const paginationFooterCls = `flex items-center justify-between gap-3 border-t px-5 py-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const modalFooterCls = `flex justify-end gap-2.5 border-t px-6 py-4 mt-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const parentBoxCls = `rounded-xl border p-4 ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Users className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Μαθητές</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Διαχείριση μαθητών του σχολείου σας.</p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <Users className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {students.length} σύνολο
                </span>
                {search.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Search className="h-3 w-3" />
                    {filteredStudents.length} αποτελέσματα
                  </span>
                )}
                {refreshing && (
                  <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Loader2 className="h-3 w-3 animate-spin" />ενημέρωση…
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={`${inputCls} pl-9 sm:w-52`} placeholder="Αναζήτηση μαθητή..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη μαθητή
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className={cardCls}>
        {loading && students.length === 0 ? (
          <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Users className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη μαθητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη μαθητή» για να δημιουργήσετε τον πρώτο.</p>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν μαθητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[
                    { icon: <User className="h-3 w-3" />, label: 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ' },
                    { icon: <Layers className="h-3 w-3" />, label: 'ΕΠΙΠΕΔΟ' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'ΗΜ. ΓΕΝΝΗΣΗΣ' },
                    { icon: <Phone className="h-3 w-3" />, label: 'ΤΗΛΕΦΩΝΟ' },
                    { icon: <Mail className="h-3 w-3" />, label: 'EMAIL' },
                    { icon: <FileText className="h-3 w-3" />, label: 'ΣΗΜΕΙΩΣΕΙΣ' },
                  ].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5"><span className="opacity-60">{icon}</span>{label}</span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedStudents.map((s) => {
                  const levelName = s.level_id ? (levelNameById.get(s.level_id) ?? '—') : '—';
                  return (
                    <tr key={s.id} className={trHoverCls}>
                      <td className="px-5 py-3.5">
                        <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{s.full_name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {levelName !== '—'
                          ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-600/50 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{levelName}</span>
                          : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className={`px-5 py-3.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {s.date_of_birth ? formatDateToGreek(s.date_of_birth) : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {s.phone || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {s.email || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 max-w-[160px]">
                        {s.special_notes?.trim()
                          ? <span className={`truncate block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.special_notes}</span>
                          : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => setInfoStudent(s)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-600/50 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:bg-slate-700/50 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-700'}`}
                            title="Πληροφορίες γονέων">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          <EditDeleteButtons onEdit={() => openEditModal(s)} onDelete={() => { setError(null); setDeleteTarget(s); }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredStudents.length > 0 && (
          <div className={paginationFooterCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{filteredStudents.length}</span> μαθητές
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={`rounded-lg border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/20 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Parents info modal ── */}
      {infoStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <UserCheck className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Πληροφορίες γονέων</h2>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{infoStudent.full_name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setInfoStudent(null)} className={closeBtnCls}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3 px-6 pb-6">
              {[
                { title: 'Πατέρας', name: infoStudent.father_name, dob: infoStudent.father_date_of_birth, phone: infoStudent.father_phone, email: infoStudent.father_email },
                { title: 'Μητέρα', name: infoStudent.mother_name, dob: infoStudent.mother_date_of_birth, phone: infoStudent.mother_phone, email: infoStudent.mother_email },
              ].map(({ title, name, dob, phone: p, email: em }) => (
                <div key={title} className={parentBoxCls}>
                  <p className={`mb-3 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoField label="Ονοματεπώνυμο" value={name} isDark={isDark} />
                    <InfoDateField label="Ημ. γέννησης" iso={dob} isDark={isDark} />
                    <InfoField label="Τηλέφωνο" value={p} isDark={isDark} />
                    <InfoField label="Email" value={em} isDark={isDark} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                    {modalMode === 'create' ? 'Νέος μαθητής' : 'Επεξεργασία μαθητή'}
                  </h2>
                  {modalMode === 'edit' && editingStudent && (
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{editingStudent.full_name}</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => closeModal()} className={closeBtnCls}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1.5 px-6 pb-3">
              {(['student', 'parents'] as TabKey[]).map((tab) => {
                const active = modalTab === tab;
                const label = tab === 'student' ? 'Μαθητής' : 'Γονείς';
                const Icon = tab === 'student' ? User : UserCheck;
                return (
                  <button key={tab} type="button" onClick={() => setModalTab(tab)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                    style={active ? {
                      backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                      color: 'var(--color-accent)',
                    } : {
                      backgroundColor: 'transparent',
                      borderColor: isDark ? 'rgb(71 85 105 / 0.5)' : 'rgb(203 213 225)',
                      color: isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)',
                    }}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="max-h-[60vh] overflow-y-auto px-6 pb-2">
                {modalTab === 'student' ? (
                  <div className="space-y-4">
                    <FormField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                      <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </FormField>
                    <FormField label="Επίπεδο" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
                      <select className={inputCls} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                        <option value="">Χωρίς επίπεδο</option>
                        {levels.map((lvl) => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Ημερομηνία γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                      <DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="π.χ. 24/12/2010" id="student-dob" />
                    </FormField>
                    <FormField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                      <input className={inputCls} placeholder="π.χ. 6900000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </FormField>
                    <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                      <input type="email" className={inputCls} placeholder="π.χ. student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormField>
                    <FormField label="Ειδικές σημειώσεις" icon={<FileText className="h-3 w-3" />} isDark={isDark}>
                      <input className={inputCls} placeholder="π.χ. αλλεργίες / παρατηρήσεις" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} />
                    </FormField>
                    {modalMode === 'create' && (
                      <FormField label="Κωδικός" icon={<Lock className="h-3 w-3" />} hint="Θα δημιουργηθεί λογαριασμός για login στο mobile app." isDark={isDark}>
                        <input type="password" className={inputCls} placeholder="Τουλάχιστον 6 χαρακτήρες" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                      </FormField>
                    )}
                    {modalMode === 'edit' && (
                      <FormField label="Νέος κωδικός (προαιρετικό)" icon={<Lock className="h-3 w-3" />} hint="Άφησέ το κενό αν δεν θες αλλαγή. Δεν μπορείς να δεις τον τρέχοντα κωδικό." isDark={isDark}>
                        <input type="password" className={inputCls} placeholder="Άφησέ το κενό αν δεν θες αλλαγή" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
                      </FormField>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { title: 'Πατέρας', name: fatherName, setName: setFatherName, dob: fatherDob, setDob: setFatherDob, dobId: 'father-dob', phone: fatherPhone, setPhone: setFatherPhone, email: fatherEmail, setEmail: setFatherEmail },
                      { title: 'Μητέρα', name: motherName, setName: setMotherName, dob: motherDob, setDob: setMotherDob, dobId: 'mother-dob', phone: motherPhone, setPhone: setMotherPhone, email: motherEmail, setEmail: setMotherEmail },
                    ].map(({ title, name, setName, dob, setDob, dobId, phone: ph, setPhone: setPh, email: em, setEmail: setEm }) => (
                      <div key={title} className={parentBoxCls}>
                        <p className={`mb-3 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</p>
                        <div className="space-y-3">
                          <FormField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                            <input className={inputCls} placeholder={`π.χ. ${title === 'Πατέρας' ? 'Δημήτρης' : 'Μαρία'} Παπαδόπουλος`} value={name} onChange={(e) => setName(e.target.value)} />
                          </FormField>
                          <FormField label="Ημερομηνία γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                            <DatePickerField label="" value={dob} onChange={setDob} placeholder="π.χ. 24/12/1980" id={dobId} />
                          </FormField>
                          <FormField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                            <input className={inputCls} placeholder="π.χ. 6900000000" value={ph} onChange={(e) => setPh(e.target.value)} />
                          </FormField>
                          <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                            <input type="email" className={inputCls} placeholder="π.χ. parent@example.com" value={em} onChange={(e) => setEm(e.target.value)} />
                          </FormField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={modalFooterCls}>
                <button type="button" onClick={() => closeModal()} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
                <button type="submit" disabled={saving}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                  {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : modalMode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <Users className="h-5 w-5 text-red-400" />
              </div>
              <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγραφή μαθητή</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλετε να διαγράψετε τον μαθητή{' '}
                <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.full_name}»</span>;
                {' '}Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deleting) setDeleteTarget(null); }} disabled={deleting} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={async () => {
                  if (!deleteTarget) return;
                  setDeleting(true); setError(null);
                  const { error: dbError } = await supabase.from('students').delete().eq('id', deleteTarget.id).eq('school_id', schoolId ?? '');
                  setDeleting(false);
                  if (dbError) { console.error(dbError); setError('Αποτυχία διαγραφής μαθητή.'); return; }
                  const nextList = students.filter((s) => s.id !== deleteTarget.id);
                  setStudents(nextList); sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
                  setDeleteTarget(null);
                }} disabled={deleting}
                  className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}