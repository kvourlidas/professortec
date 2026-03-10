import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { Star, MessageSquareText } from 'lucide-react';

import type { RowVM } from '../../components/feedback/types';
import { FEEDBACK_TABLE } from '../../components/feedback/constants';
import { clampRating } from '../../components/feedback/utils';
import { Stars } from '../../components/feedback/Stars';
import { FeedbackTable } from '../../components/feedback/FeedbackTable';

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);

  const avgCardCls = isDark
    ? 'shrink-0 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/40 px-5 py-3.5 backdrop-blur'
    : 'shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm';

  useEffect(() => { setPage(1); setAvgRating(null); setRatingsCount(0); }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setRows([]); setTotal(0); setAvgRating(null); setRatingsCount(0); setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Only fetch rows with rating > 0 OR non-empty feedback
        const fbRes = await supabase
          .from(FEEDBACK_TABLE)
          .select('student_id, rating, feedback, updated_at', { count: 'exact' })
          .eq('school_id', schoolId)
          .or('rating.gt.0,feedback.neq.')
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (fbRes.error) {
          console.error(fbRes.error);
          setError('Αποτυχία φόρτωσης.');
          setRows([]); setTotal(0); return;
        }

        setTotal(fbRes.count ?? 0);

        // Avg rating across ALL feedback (not just current page)
        const avgRes = await supabase
          .from(FEEDBACK_TABLE)
          .select('rating', { count: 'exact' })
          .eq('school_id', schoolId)
          .gt('rating', 0);

        if (!avgRes.error) {
          const ratings = (avgRes.data ?? [])
            .map((x: any) => Number(x.rating))
            .filter((n: number) => Number.isFinite(n) && n > 0);
          setRatingsCount(avgRes.count ?? ratings.length);
          setAvgRating(ratings.length === 0 ? null : ratings.reduce((a, b) => a + b, 0) / ratings.length);
        } else { setAvgRating(null); setRatingsCount(0); }

        // Fetch student names for current page
        const studentIds = (fbRes.data ?? []).map((fb: any) => fb.student_id).filter(Boolean);
        const studentNames = new Map<string, string>();

        if (studentIds.length > 0) {
          const studRes = await supabase
            .from('students')
            .select('id, full_name')
            .in('id', studentIds);
          if (!studRes.error) {
            (studRes.data ?? []).forEach((s: any) => studentNames.set(s.id, s.full_name ?? '—'));
          }
        }

        setRows((fbRes.data ?? []).map((fb: any) => ({
          studentId: fb.student_id,
          fullName: studentNames.get(fb.student_id) ?? '—',
          rating: clampRating(Number(fb.rating ?? 0)),
          feedback: (fb.feedback ?? '').trim(),
          updatedAt: fb.updated_at ?? null,
        })));

      } catch (e) {
        console.error(e);
        setError('Αποτυχία φόρτωσης δεδομένων.');
        setRows([]); setTotal(0); setAvgRating(null); setRatingsCount(0);
      } finally { setLoading(false); }
    };
    load();
  }, [schoolId, page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6 px-1">

      {/* Header */}
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
                  {total} αξιολογήσεις
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

      {/* Alerts */}
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

      {/* Table */}
      <FeedbackTable
        loading={loading}
        rows={rows}
        total={total}
        page={page}
        pageCount={pageCount}
        showingFrom={showingFrom}
        showingTo={showingTo}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        isDark={isDark}
      />
    </div>
  );
}