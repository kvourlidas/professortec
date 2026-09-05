// src/pages/StudentsPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users, Search, UserPlus, ChevronLeft, ChevronRight,
  Loader2, Trash2, Copy, Check, IdCard, Upload,
} from 'lucide-react';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../auth.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import StudentCreateModal from '../components/students/StudentCreateModal.tsx';
import StudentImportModal from '../components/students/StudentImportModal.tsx';
import ColumnFilterDropdown, {
  ALL_COLUMNS, DEFAULT_VISIBLE, type ColumnKey,
} from '../components/students/ColumnFilterDropdown.tsx';
import SortDropdown, {
  DEFAULT_SORT, type SortState, type SortField,
} from '../components/students/SortDropdown.tsx';
import PageSizeDropdown, {
  type PageSizeOption,
} from '../components/students/PageSizeDropdown.tsx';
import { exportStudentsToExcel, exportStudentsToPdf } from '../components/students/exportStudents.ts';
import type { StudentRow, LevelRow } from '../components/students/types.ts';
import { STUDENT_SELECT, formatDateToGreek, normalizeText } from '../components/students/types.ts';

const FETCH_TIMEOUT_MS = 8000;
const COLUMNS_STORAGE_KEY = 'pt_students_visible_columns_v1';
const SORT_STORAGE_KEY = 'pt_students_sort_v1';
const PAGE_SIZE_STORAGE_KEY = 'pt_students_page_size_v1';

// Strips Greek accent marks so CSS uppercase doesn't produce e.g. ΟΝΟΜΑΤΕΠΏΝΥΜΟ
function stripGreekAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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
function loadSavedColumns(): Set<ColumnKey> {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const parsed = JSON.parse(raw) as ColumnKey[];
    if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE);
}
function loadSavedSort(): SortState {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SortState;
      if (parsed?.field && parsed?.dir) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_SORT;
}
function loadSavedPageSize(): PageSizeOption {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10) as PageSizeOption;
      if ([10, 25, 50, 100].includes(n)) return n;
    }
  } catch { /* ignore */ }
  return 10;
}

// ── Sort comparator ──────────────────────────────────────────────────────────
function sortStudents(
  list: StudentRow[],
  sort: SortState,
  levelNameById: Map<string, string>,
): StudentRow[] {
  const { field, dir } = sort;
  const mul = dir === 'asc' ? 1 : -1;

  return [...list].sort((a, b) => {
    let va: string | null = null;
    let vb: string | null = null;

    switch (field as SortField) {
      case 'full_name': va = a.full_name; vb = b.full_name; break;
      case 'level':
        va = a.level_id ? (levelNameById.get(a.level_id) ?? null) : null;
        vb = b.level_id ? (levelNameById.get(b.level_id) ?? null) : null;
        break;
      case 'date_of_birth': va = a.date_of_birth; vb = b.date_of_birth; break;
      case 'created_at': va = a.created_at; vb = b.created_at; break;
      case 'phone': va = a.phone; vb = b.phone; break;
      case 'email': va = a.email; vb = b.email; break;
    }

    // nulls always last regardless of direction
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;

    // date strings (ISO yyyy-mm-dd) compare lexicographically correctly
    return mul * va.localeCompare(vb, 'el', { sensitivity: 'base' });
  });
}

export default function StudentsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const navigate = useNavigate();
  const location = useLocation();

  const studentsCacheKey = schoolId ? `pt_students_cache_v1_${schoolId}` : '';
  const levelsCacheKey = schoolId ? `pt_levels_cache_v1_${schoolId}` : '';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    if ((location.state as { openCreate?: boolean } | null)?.openCreate) {
      setCreateModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEscapeToClose(!!deleteTarget, () => { if (!deleting) setDeleteTarget(null); });

  const [excelBusy, setExcelBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportError, setExportError] = useState<'excel' | 'pdf' | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // ── Persisted preferences ──
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadSavedColumns);
  const [sort, setSort] = useState<SortState>(loadSavedSort);
  const [pageSize, setPageSize] = useState<PageSizeOption>(loadSavedPageSize);

  const handleColumnsChange = (next: Set<ColumnKey>) => {
    setVisibleColumns(next);
    try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };
  const handleSortChange = (next: SortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const handlePageSizeChange = (next: PageSizeOption) => {
    setPageSize(next);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next)); } catch { /* ignore */ }
  };

  const studentsReqRef = useRef(0);
  const levelsReqRef = useRef(0);

  useEffect(() => { setPage(1); }, [search]);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  const hintHydrate = useCallback(() => {
    if (!schoolId) return;
    const cachedStudents = safeParseJSON<StudentRow[]>(sessionStorage.getItem(studentsCacheKey));
    const cachedLevels = safeParseJSON<LevelRow[]>(sessionStorage.getItem(levelsCacheKey));
    if (cachedStudents?.length) { setStudents(cachedStudents); setLoading(false); } else { setLoading(true); }
    if (cachedLevels) setLevels(cachedLevels);
  }, [schoolId, studentsCacheKey, levelsCacheKey]);

  const loadLevels = useCallback(async () => {
    if (!schoolId) return;
    const reqId = ++levelsReqRef.current;
    try {
      const res = await withTimeout(supabase.from('levels').select('id, school_id, name, created_at').eq('school_id', schoolId).order('name', { ascending: true }), FETCH_TIMEOUT_MS);
      if (reqId !== levelsReqRef.current) return;
      const data = (res as any).data as LevelRow[] | null;
      const next = (data ?? []) as LevelRow[];
      setLevels(next); sessionStorage.setItem(levelsCacheKey, JSON.stringify(next));
    } catch (e) { console.error(e); }
  }, [schoolId, levelsCacheKey]);

  const loadStudents = useCallback(async (opts?: { silent?: boolean }) => {
    if (!schoolId) { setLoading(false); return; }
    const reqId = ++studentsReqRef.current;
    if (opts?.silent) setRefreshing(true); else setLoading(students.length === 0);
    setError(null);
    try {
      const res = await withTimeout(supabase.from('students').select(STUDENT_SELECT).eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }), FETCH_TIMEOUT_MS);
      if (reqId !== studentsReqRef.current) return;
      const dbError = (res as any).error; const data = (res as any).data as StudentRow[] | null;
      if (dbError) { console.error(dbError); setError('Αποτυχία φόρτωσης μαθητών.'); return; }
      const next = (data ?? []) as StudentRow[];
      setStudents(next); sessionStorage.setItem(studentsCacheKey, JSON.stringify(next));
    } catch (e) { console.error(e); if (reqId !== studentsReqRef.current) return; setError('Αποτυχία φόρτωσης μαθητών.'); }
    finally { if (reqId === studentsReqRef.current) { if (opts?.silent) setRefreshing(false); setLoading(false); } }
  }, [schoolId, studentsCacheKey, students.length]);

  useEffect(() => {
    setError(null);
    if (!schoolId) { setStudents([]); setLevels([]); setLoading(false); return; }
    hintHydrate();
  }, [schoolId, hintHydrate]);

  useEffect(() => {
    if (!schoolId) return;
    loadLevels(); loadStudents({ silent: true });
  }, [schoolId, loadLevels, loadStudents]);

  useEffect(() => {
    if (!schoolId) return;
    const refetch = () => { hintHydrate(); loadStudents({ silent: true }); loadLevels(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch(); };
    globalThis.addEventListener('focus', refetch); globalThis.addEventListener('online', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { globalThis.removeEventListener('focus', refetch); globalThis.removeEventListener('online', refetch); document.removeEventListener('visibilitychange', onVisibility); };
  }, [schoolId, loadStudents, loadLevels, hintHydrate]);

  const handleCreated = (student: StudentRow) => {
    const nextList = [...students, student].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'));
    setStudents(nextList); sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
    setCreateModalOpen(false);
  };

  const handleImported = (newStudents: StudentRow[]) => {
    if (newStudents.length === 0) return;
    setStudents((prev) => {
      const nextList = [...prev, ...newStudents].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'));
      sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
      return nextList;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase.functions.invoke('student-delete', {
      body: {
        student_id: deleteTarget.id,
      },
    });

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής μαθητή.');
      return;
    }

    const nextList = students.filter((s) => s.id !== deleteTarget.id);
    setStudents(nextList);
    sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
    setDeleteTarget(null);
  };

  // ── Pipeline: filter → sort → paginate ──────────────────────────────────
  const filteredStudents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return students;
    return students.filter((s) => {
      const levelName = s.level_id ? (levelNameById.get(s.level_id) ?? '') : '';
      const composite = [s.full_name, levelName, s.phone, s.email, s.special_notes, s.address, s.school_name, s.father_name, s.mother_name].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [students, levelNameById, search]);

  const sortedStudents = useMemo(
    () => sortStudents(filteredStudents, sort, levelNameById),
    [filteredStudents, sort, levelNameById],
  );

  const pageCount = useMemo(() => Math.max(1, Math.ceil(sortedStudents.length / pageSize)), [sortedStudents.length, pageSize]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, page, pageSize]);

  const showingFrom = sortedStudents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, sortedStudents.length);

  const handleExportExcel = async () => {
    setExportError(null);
    setExcelBusy(true);
    try {
      await exportStudentsToExcel(sortedStudents, levelNameById);
    } catch (err) {
      console.error('Export Excel error', err);
      setExportError('excel');
    } finally {
      setExcelBusy(false);
    }
  };

  const handleExportPdf = async () => {
    setExportError(null);
    setPdfBusy(true);
    try {
      await exportStudentsToPdf(sortedStudents, levelNameById);
    } catch (err) {
      console.error('Export PDF error', err);
      setExportError('pdf');
    } finally {
      setPdfBusy(false);
    }
  };

  const visibleColumnDefs = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.has(c.key)),
    [visibleColumns],
  );

  // ── Copy button ──────────────────────────────────────────────────────────
  const CopyBtn = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    return (
      <button type="button" title="Αντιγραφή"
        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        className={`ml-1.5 shrink-0 rounded p-0.5 transition-colors ${isDark ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  };

  // ── Cell renderer ────────────────────────────────────────────────────────
  const renderCell = (key: ColumnKey, s: StudentRow) => {
    const empty = <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>;
    switch (key) {
      case 'full_name':
        return <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{s.full_name}</span>;
      case 'level': {
        const lvl = s.level_id ? (levelNameById.get(s.level_id) ?? null) : null;
        return lvl
          ? <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{lvl}</span>
          : empty;
      }
      case 'date_of_birth': return s.date_of_birth ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(s.date_of_birth)}</span> : empty;
      case 'phone': return s.phone ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.phone}</span> : empty;
      case 'email': return s.email ? <span className="inline-flex items-center"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.email}</span><CopyBtn text={s.email} /></span> : empty;
      case 'special_notes': return s.special_notes?.trim() ? <span className={`truncate block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.special_notes}</span> : empty;
      case 'address': return s.address ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.address}</span> : empty;
      case 'school_name': return s.school_name ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.school_name}</span> : empty;
      case 'father_name': return s.father_name ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.father_name}</span> : empty;
      case 'father_date_of_birth': return s.father_date_of_birth ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(s.father_date_of_birth)}</span> : empty;
      case 'father_phone': return s.father_phone ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.father_phone}</span> : empty;
      case 'father_email': return s.father_email ? <span className="inline-flex items-center"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.father_email}</span><CopyBtn text={s.father_email} /></span> : empty;
      case 'father_afm': return s.father_afm ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.father_afm}</span> : empty;
      case 'mother_name': return s.mother_name ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.mother_name}</span> : empty;
      case 'mother_date_of_birth': return s.mother_date_of_birth ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(s.mother_date_of_birth)}</span> : empty;
      case 'mother_phone': return s.mother_phone ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.mother_phone}</span> : empty;
      case 'mother_email': return s.mother_email ? <span className="inline-flex items-center"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.mother_email}</span><CopyBtn text={s.mother_email} /></span> : empty;
      case 'mother_afm': return s.mother_afm ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.mother_afm}</span> : empty;
      case 'created_at': return s.created_at ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(s.created_at.slice(0, 10))}</span> : empty;
      default: return empty;
    }
  };

  // ── Style helpers — minimal: no cell/card borders, just one accent rule under the header ──
  const tableCardCls = '';
  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const theadRowCls = '';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';
  const trHoverCls = isDark ? 'transition-colors hover:bg-[color:var(--color-accent)]/[0.12]' : 'transition-colors hover:bg-[color:var(--color-accent)]/10';
  const modalBg = isDark ? 'border-slate-700/60' : 'border-slate-200';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;
  const paginationBarCls = 'flex items-center justify-between gap-3 pt-4';
  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';
  const paginationPageCls = isDark ? 'px-2 text-[11px] text-slate-300' : 'px-2 text-[11px] text-slate-600';
  const deleteBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500';

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Badges + controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Total */}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            <Users className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            {students.length} σύνολο
          </span>

          {/* Search results */}
          {search.trim() && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
              style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              <Search className="h-3 w-3" />
              {sortedStudents.length} αποτελέσματα
            </span>
          )}

          {refreshing && (
            <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Loader2 className="h-3 w-3 animate-spin" />ενημέρωση…
            </span>
          )}

          {/* Divider */}
          <span className={`h-3.5 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />

          {/* Sort */}
          <SortDropdown sort={sort} onChange={handleSortChange} isDark={isDark} />

          {/* Columns */}
          <ColumnFilterDropdown visible={visibleColumns} onChange={handleColumnsChange} isDark={isDark} />

          {/* Page size */}
          <PageSizeDropdown value={pageSize} onChange={handlePageSizeChange} isDark={isDark} />
        </div>

        {/* Right: search + add */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={`${inputCls} pl-9 sm:w-52`} placeholder="Αναζήτηση μαθητή..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={() => setImportModalOpen(true)} className={`btn h-9 gap-2 border px-4 font-semibold ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Upload className="h-3.5 w-3.5" />
            Εισαγωγή από Excel
          </button>
          <button type="button" onClick={() => setCreateModalOpen(true)} className="btn-primary h-9 gap-2 px-4 font-semibold">
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη μαθητή
          </button>
        </div>
      </div>

      {/* ── Export buttons ── */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={excelBusy || sortedStudents.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            {excelBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FaFileExcel className="h-3 w-3" />}
            {excelBusy ? 'Δημιουργία…' : 'Λήψη Αναφοράς'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfBusy || sortedStudents.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'}`}
          >
            {pdfBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FaFilePdf className="h-3 w-3" />}
            {pdfBusy ? 'Δημιουργία…' : 'Λήψη Αναφοράς'}
          </button>
        </div>
        {exportError && (
          <p className="text-[11px] text-red-500">Αποτυχία δημιουργίας {exportError === 'pdf' ? 'PDF' : 'Excel'}.</p>
        )}
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
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {/* ── Table card ── */}
      <div className={tableCardCls}>
        {loading && students.length === 0 ? (
          <div className="space-y-3">
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
        ) : sortedStudents.length === 0 ? (
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
                <tr className={theadRowCls} style={{ borderBottom: '2px solid var(--color-accent)' }}>
                  <th style={{ width: '1%' }} className={`whitespace-nowrap px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${visibleColumnDefs.length > 0 ? colDivider : ''} ${isDark ? 'text-white' : 'text-black'}`}>#</th>
                  {visibleColumnDefs.map((col) => (
                    <th key={col.key} className={`px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>
                      {stripGreekAccents(col.label)}
                    </th>
                  ))}
                  <th className={`px-5 pb-3 text-right text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedStudents.map((s, i) => (
                  <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)} title="Άνοιγμα κάρτας μαθητή" className={`group cursor-pointer ${trHoverCls}`}>
                    <td className={`whitespace-nowrap px-5 py-3.5 tabular-nums transition-colors group-hover:[text-shadow:0_0_0.55px_currentColor,0_0_0.55px_currentColor] ${visibleColumnDefs.length > 0 ? colDivider : ''} ${isDark ? 'text-slate-600 group-hover:text-slate-200' : 'text-slate-300 group-hover:text-slate-600'}`}>{(page - 1) * pageSize + i + 1}</td>
                    {visibleColumnDefs.map((col) => (
                      <td key={col.key} className={`px-5 py-3.5 group-hover:[text-shadow:0_0_0.55px_currentColor,0_0_0.55px_currentColor] ${colDivider}${col.key === 'special_notes' ? ' max-w-[160px]' : ''}`}>
                        {renderCell(col.key, s)}
                      </td>
                    ))}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                          title="Άνοιγμα κάρτας μαθητή"
                          className="flex items-center gap-1.5 text-xs font-semibold transition hover:underline"
                          style={{ color: 'var(--color-accent)' }}>
                          <IdCard className="h-3.5 w-3.5" />
                          Καρτέλα μαθητή
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setError(null); setDeleteTarget(s); }}
                          className={deleteBtnCls}
                          title="Διαγραφή">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination footer ── */}
        {!loading && sortedStudents.length > 0 && (
          <div className={paginationBarCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{sortedStudents.length}</span> μαθητές
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create modal ── */}
      {createModalOpen && schoolId && (
        <StudentCreateModal schoolId={schoolId} levels={levels} onCreated={handleCreated} onClose={() => setCreateModalOpen(false)} />
      )}

      {/* ── Import modal ── */}
      {importModalOpen && schoolId && (
        <StudentImportModal schoolId={schoolId} levels={levels} onImported={handleImported} onClose={() => setImportModalOpen(false)} />
      )}

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`} style={{ background: 'var(--color-sidebar)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <Users className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Διαγραφή μαθητή</h3>
            </div>
            <div className="p-6">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλετε να διαγράψετε τον μαθητή{' '}
                <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.full_name}»</span>;
                {' '}Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deleting) setDeleteTarget(null); }} disabled={deleting} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="btn bg-red-600 px-4 py-1.5 font-semibold text-white hover:bg-red-500 disabled:opacity-60">
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