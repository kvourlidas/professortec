import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import StyledSelect from '../ui/StyledSelect';
import { displayToISO, formatDateDisplay, normalizeText } from './utils';
import { monthKeyToRange, pad2 } from '../economics/subscriptions/utils';
import { isSchoolYearCurrent } from '../school-info/types';
import type { PrivateAttendanceRow, SubjectRow } from './types';

const PAGE_SIZE = 20;
const UNFILTERED_LIMIT = 300;

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

type StatsMode = 'month' | 'year' | 'total';
type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string };
type AttendanceStatusRow = { status: 'present' | 'absent' };

interface Props {
  schoolId: string | null;
  studentNameById: Map<string, string>;
  isDark: boolean;
}

export default function PrivateAttendanceHistoryPanel({ schoolId, studentNameById, isDark }: Props) {
  const [dateFilter, setDateFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [rows, setRows] = useState<PrivateAttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [programItemSubjectId, setProgramItemSubjectId] = useState<Map<string, string>>(new Map());

  // ── Attendance summary (present/absent totals + %), filterable by month / school year / total ──
  const [statsMode, setStatsMode] = useState<StatsMode>('month');
  const [statsMonthKey, setStatsMonthKey] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; });
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [statsYearId, setStatsYearId] = useState<string | null>(null);
  const [statsRows, setStatsRows] = useState<AttendanceStatusRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const subjectNameById = useMemo(() => {
    const m = new Map<string, string>();
    subjects.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [subjects]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data: subjData } = await supabase.from('subjects').select('id, name').eq('school_id', schoolId);
      const { data: programData } = await supabase.from('programs').select('id').eq('school_id', schoolId);
      const programIds = (programData ?? []).map((p: { id: string }) => p.id);
      const { data: itemData } = programIds.length > 0
        ? await supabase.from('program_items').select('id, subject_id').in('program_id', programIds).not('student_id', 'is', null)
        : { data: [] };
      if (cancelled) return;
      setSubjects((subjData ?? []) as SubjectRow[]);
      const m = new Map<string, string>();
      (itemData ?? []).forEach((i: { id: string; subject_id: string | null }) => { if (i.subject_id) m.set(i.id, i.subject_id); });
      setProgramItemSubjectId(m);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  const subjectNameForRow = (r: PrivateAttendanceRow) => {
    const subjectId = programItemSubjectId.get(r.program_item_id) ?? null;
    return (subjectId ? subjectNameById.get(subjectId) : null) ?? '—';
  };

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('school_years')
        .select('id, name, start_date, end_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false });
      if (cancelled) return;
      const years = (data ?? []) as SchoolYearOption[];
      setSchoolYears(years);
      setStatsYearId((prev) => prev ?? years.find((y) => isSchoolYearCurrent(y))?.id ?? years[0]?.id ?? null);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    if (statsMode === 'year' && !statsYearId) { setStatsRows([]); return; }
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      let query = supabase.from('private_lesson_attendance').select('status').eq('school_id', schoolId);
      if (statsMode === 'month') {
        const range = monthKeyToRange(statsMonthKey);
        if (range) query = query.gte('session_date', range.startISO).lte('session_date', range.endISO);
      } else if (statsMode === 'year') {
        const year = schoolYears.find((y) => y.id === statsYearId);
        if (year) query = query.gte('session_date', year.start_date).lte('session_date', year.end_date);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) { console.error('Error loading attendance stats', error); setStatsRows([]); }
      else setStatsRows((data ?? []) as AttendanceStatusRow[]);
      setStatsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, statsMode, statsMonthKey, statsYearId, schoolYears]);

  const shiftStatsMonth = (delta: number) => {
    setStatsMonthKey((k) => {
      const [yStr, mStr] = k.split('-');
      let y = Number(yStr), m = Number(mStr) + delta;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      return `${y}-${pad2(m)}`;
    });
  };

  const statsPresentCount = statsRows.filter((r) => r.status === 'present').length;
  const statsAbsentCount = statsRows.filter((r) => r.status === 'absent').length;
  const statsTotal = statsPresentCount + statsAbsentCount;
  const statsPct = statsTotal > 0 ? (statsPresentCount / statsTotal) * 100 : null;

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let query = supabase.from('private_lesson_attendance').select('*').eq('school_id', schoolId)
        .order('session_date', { ascending: false }).order('created_at', { ascending: false });
      if (dateFilter) query = query.eq('session_date', dateFilter);
      if (!dateFilter) query = query.limit(UNFILTERED_LIMIT);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) { console.error('Error loading attendance history', error); setRows([]); }
      else setRows((data ?? []) as PrivateAttendanceRow[]);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, dateFilter]);

  const handleDateChange = (v: string) => { setDateFilter(v); setPage(1); };
  const handleSearchChange = (v: string) => { setStudentSearch(v); setPage(1); };
  const clearFilters = () => { setDateFilter(''); setPage(1); };

  const filteredRows = useMemo(() => {
    const q = normalizeText(studentSearch.trim());
    if (!q) return rows;
    return rows.filter((r) => normalizeText(studentNameById.get(r.student_id) ?? '').includes(q));
  }, [rows, studentSearch, studentNameById]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredRows, page]);
  const showingFrom = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredRows.length);

  const inputCls = isDark
    ? 'h-9 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';
  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div className="space-y-4">
      {/* Summary — present/absent totals + attendance % */}
      <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800/60 bg-slate-950/30' : 'border-slate-200 bg-white'}`}>
        <h3 className={`mb-3 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>Σύνοψη Παρουσιών</h3>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {([['month', 'Μήνας'], ['year', 'Σχολικό Έτος'], ['total', 'Σύνολο']] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setStatsMode(mode)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                statsMode === mode
                  ? 'text-white'
                  : isDark ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
              style={statsMode === mode ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {statsMode === 'month' && (
          <div className={`mb-3 flex items-center justify-center gap-3 rounded-xl border py-1.5 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
            <button type="button" onClick={() => shiftStatsMonth(-1)}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className={`min-w-[9rem] text-center text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {MONTH_NAMES[Number(statsMonthKey.split('-')[1]) - 1]} {statsMonthKey.split('-')[0]}
            </span>
            <button type="button" onClick={() => shiftStatsMonth(1)}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {statsMode === 'year' && (
          schoolYears.length > 0 ? (
            <div className="mb-3">
              <StyledSelect
                isDark={isDark} showChevron
                value={statsYearId ?? ''}
                onChange={setStatsYearId}
                className={`h-8 w-full max-w-xs rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                options={schoolYears.map((y) => ({ value: y.id, label: y.name }))}
              />
            </div>
          ) : (
            <p className={`mb-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Δεν έχει οριστεί σχολικό έτος (Πληροφορίες Σχολείου).
            </p>
          )
        )}

        {statsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className={`h-5 w-5 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        ) : statsTotal === 0 ? (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένες παρουσίες για αυτήν την περίοδο.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Παρουσιες</p>
              <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{statsPresentCount}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-rose-500/30 bg-rose-950/30' : 'border-rose-200 bg-rose-50'}`}>
              <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Απουσιες</p>
              <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{statsAbsentCount}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50'}`}>
              <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ποσοστο Παρουσιας</p>
              <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{statsPct !== null ? `${statsPct.toFixed(0)}%` : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:w-44">
          <AppDatePicker value={dateFilter ? formatDateDisplay(dateFilter) : ''} onChange={(v) => handleDateChange(v ? displayToISO(v) : '')} />
        </div>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={studentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Αναζήτηση μαθητή..."
            className={`${inputCls} w-full pl-9 sm:w-56`}
          />
        </div>
        {dateFilter && (
          <button type="button" onClick={clearFilters}
            className={`text-[11px] font-medium underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Καθαρισμός φίλτρων
          </button>
        )}
      </div>

      {!dateFilter && rows.length === UNFILTERED_LIMIT && (
        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Εμφανίζονται οι {UNFILTERED_LIMIT} πιο πρόσφατες εγγραφές — χρησιμοποιήστε τα φίλτρα για παλαιότερες.
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16">
          <Loader2 className={`h-5 w-5 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν εγγραφές</p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-accent)' }}>
                <th className={`whitespace-nowrap px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Ημερομηνία</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Μάθημα</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Μαθητής</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Κατάσταση</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>Λόγος</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200'}>
              {pagedRows.map((r) => (
                <tr key={r.id} className={isDark ? 'transition-colors hover:bg-[color:var(--color-accent)]/[0.12]' : 'transition-colors hover:bg-[color:var(--color-accent)]/10'}>
                  <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${colDivider} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatDateDisplay(r.session_date)}</td>
                  <td className={`px-4 py-3 ${colDivider} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{subjectNameForRow(r)}</td>
                  <td className={`px-4 py-3 font-medium ${colDivider} ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{studentNameById.get(r.student_id) ?? '—'}</td>
                  <td className={`px-4 py-3 ${colDivider}`}>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === 'present'
                        ? isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : isDark ? 'border-rose-500/40 bg-rose-500/10 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}>
                      {r.status === 'present' ? 'Παρών' : 'Απών'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredRows.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
            από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{filteredRows.length}</span> εγγραφές
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className={`px-2 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
              <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
              <span>{pageCount}</span>
            </div>
            <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
