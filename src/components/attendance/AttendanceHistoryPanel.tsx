import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { formatDateDisplay, normalizeText } from './utils';
import type { AttendanceRow, ClassRow } from './types';

const PAGE_SIZE = 15;
const UNFILTERED_LIMIT = 300;

interface Props {
  schoolId: string | null;
  classes: ClassRow[];
  studentNameById: Map<string, string>;
  isDark: boolean;
}

export default function AttendanceHistoryPanel({ schoolId, classes, studentNameById, isDark }: Props) {
  const [dateFilter, setDateFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const classTitleById = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.id, c.title));
    return m;
  }, [classes]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let query = supabase.from('class_attendance').select('*').eq('school_id', schoolId)
        .order('session_date', { ascending: false }).order('created_at', { ascending: false });
      if (dateFilter) query = query.eq('session_date', dateFilter);
      if (classFilter) query = query.eq('class_id', classFilter);
      if (!dateFilter && !classFilter) query = query.limit(UNFILTERED_LIMIT);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) { console.error('Error loading attendance history', error); setRows([]); }
      else setRows((data ?? []) as AttendanceRow[]);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, dateFilter, classFilter]);

  const handleDateChange = (v: string) => { setDateFilter(v); setPage(1); };
  const handleClassChange = (v: string) => { setClassFilter(v); setPage(1); };
  const handleSearchChange = (v: string) => { setStudentSearch(v); setPage(1); };
  const clearFilters = () => { setDateFilter(''); setClassFilter(''); setPage(1); };

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
      {/* Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <input type="date" value={dateFilter} onChange={(e) => handleDateChange(e.target.value)} className={`${inputCls} sm:w-44`} />
        <select value={classFilter} onChange={(e) => handleClassChange(e.target.value)} className={`${inputCls} sm:w-52`}>
          <option value="">Όλα τα τμήματα</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            value={studentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Αναζήτηση μαθητή..."
            className={`${inputCls} w-full pl-9 sm:w-56`}
          />
        </div>
        {(dateFilter || classFilter) && (
          <button type="button" onClick={clearFilters}
            className={`text-[11px] font-medium underline-offset-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Καθαρισμός φίλτρων
          </button>
        )}
      </div>

      {!dateFilter && !classFilter && rows.length === UNFILTERED_LIMIT && (
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
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Τμήμα</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Μαθητής</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Κατάσταση</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>Λόγος</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200'}>
              {pagedRows.map((r) => (
                <tr key={r.id} className={isDark ? 'transition-colors hover:bg-[color:var(--color-accent)]/[0.12]' : 'transition-colors hover:bg-[color:var(--color-accent)]/10'}>
                  <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${colDivider} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatDateDisplay(r.session_date)}</td>
                  <td className={`px-4 py-3 ${colDivider} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{classTitleById.get(r.class_id) ?? '—'}</td>
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
