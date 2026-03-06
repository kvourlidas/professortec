// src/pages/student-app/StudentFeedbackPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { Star, MessageSquareText, ChevronLeft, ChevronRight } from 'lucide-react';

const FEEDBACK_TABLE = 'student_feedback';

type StudentMiniRow = { id: string; full_name: string | null };
type FeedbackRow = { student_id: string; rating: number | null; feedback: string | null; updated_at: string | null };
type RowVM = { studentId: string; fullName: string; rating: number; feedback: string; updatedAt: string | null };

function clampRating(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(5, v));
}

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const rating = clampRating(value);
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < rating ? '' : 'text-slate-600'}`}
          style={i < rating ? { color: 'var(--color-accent)' } : {}}
          fill={i < rating ? 'currentColor' : 'none'} />
      ))}
    </div>
  );
}

export default function StudentFeedbackPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [rows, setRows] = useState<RowVM[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingsCount, setRatingsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 25;
  const [page, setPage] = useState(1);

  // ── Dynamic classes ──
  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadRowCls = isDark ? 'border-b border-slate-700/60 bg-slate-900/40' : 'border-b border-slate-200 bg-slate-50';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';

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

  const avgCardCls = isDark
    ? 'shrink-0 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/40 px-5 py-3.5 backdrop-blur'
    : 'shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm';

  useEffect(() => { setPage(1); setAvgRating(null); setRatingsCount(0); }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setRows([]); setTotal(0); setAvgRating(null); setRatingsCount(0); setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const studentsRes = await supabase.from('students').select('id, full_name', { count: 'exact' }).eq('school_id', schoolId).order('full_name', { ascending: true }).range(from, to);
        if (studentsRes.error) { console.error(studentsRes.error); setError('Αποτυχία φόρτωσης μαθητών.'); setRows([]); setTotal(0); return; }
        const students = (studentsRes.data ?? []) as StudentMiniRow[];
        setTotal(studentsRes.count ?? 0);

        const avgRes = await supabase.from(FEEDBACK_TABLE).select('rating', { count: 'exact' }).eq('school_id', schoolId).gt('rating', 0);
        if (!avgRes.error) {
          const ratings = (avgRes.data ?? []).map((x: any) => Number(x.rating)).filter((n: number) => Number.isFinite(n) && n > 0);
          setRatingsCount(avgRes.count ?? ratings.length);
          setAvgRating(ratings.length === 0 ? null : ratings.reduce((a, b) => a + b, 0) / ratings.length);
        } else { setAvgRating(null); setRatingsCount(0); }

        const studentIds = students.map((s) => s.id).filter(Boolean);
        const feedbackByStudent = new Map<string, FeedbackRow>();
        if (studentIds.length > 0) {
          const fbRes = await supabase.from(FEEDBACK_TABLE).select('student_id, rating, feedback, updated_at').eq('school_id', schoolId).in('student_id', studentIds).order('updated_at', { ascending: false });
          if (!fbRes.error) { ((fbRes.data ?? []) as FeedbackRow[]).forEach((fb) => { if (fb.student_id) feedbackByStudent.set(fb.student_id, fb); }); }
        }

        setRows(students.map((s) => {
          const fb = feedbackByStudent.get(s.id);
          return { studentId: s.id, fullName: (s.full_name ?? '').trim() || '—', rating: clampRating(Number(fb?.rating ?? 0)), feedback: (fb?.feedback ?? '').trim(), updatedAt: fb?.updated_at ?? null };
        }));
      } catch (e) {
        console.error(e); setError('Αποτυχία φόρτωσης δεδομένων.'); setRows([]); setTotal(0); setAvgRating(null); setRatingsCount(0);
      } finally { setLoading(false); }
    };
    load();
  }, [schoolId, page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <MessageSquareText className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Feedback μαθητών
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Αξιολογήσεις (0-5 αστέρια) και σχόλια που αφήνουν οι μαθητές.
            </p>

            {schoolId && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <MessageSquareText className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {total} μαθητές
                </span>
                {avgRating != null && (
                  <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Star className="h-3 w-3" fill="currentColor" />
                    {avgRating.toFixed(2)} / 5 · {ratingsCount} αξιολογήσεις
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Avg rating card */}
        {schoolId && avgRating != null && (
          <div className={avgCardCls}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Μέση αξιολόγηση
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Stars value={Math.round(avgRating)} size="lg" />
              <span className={`text-lg font-bold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{avgRating.toFixed(2)}</span>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ 5</span>
            </div>
            <p className={`mt-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ratingsCount} αξιολογήσεις</p>
          </div>
        )}
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

      {/* ── Table card ── */}
      <div className={tableCardCls}>
        {loading ? (
          <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-1/2 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <MessageSquareText className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Δεν υπάρχουν μαθητές.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {['ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΑΞΙΟΛΟΓΗΣΗ', 'FEEDBACK'].map((label) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {rows.map((r) => (
                  <tr key={r.studentId} className={trHoverCls}>
                    <td className="px-5 py-3.5">
                      <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {r.fullName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.rating > 0
                        ? <Stars value={r.rating} />
                        : <span className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Καμία αξιολόγηση</span>}
                    </td>
                    <td className="px-5 py-3.5 max-w-lg">
                      {r.feedback.trim()
                        ? <p className={`whitespace-pre-wrap text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{r.feedback}</p>
                        : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className={paginationBarCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{total}</span> μαθητές
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
    </div>
  );
}