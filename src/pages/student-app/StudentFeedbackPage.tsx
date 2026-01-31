// src/pages/student-app/StudentFeedbackPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { Star, MessageSquareText } from 'lucide-react';

const FEEDBACK_TABLE = 'student_feedback';

type StudentMiniRow = {
  id: string;
  full_name: string | null;
};

type FeedbackRow = {
  student_id: string;
  rating: number | null;
  feedback: string | null;
  updated_at: string | null;
};

type RowVM = {
  studentId: string;
  fullName: string;
  rating: number; // 0..5
  feedback: string; // '' if none
  updatedAt: string | null;
};

function clampRating(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(5, v));
}

function Stars({ value }: { value: number }) {
  const rating = clampRating(value);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < rating;
        return (
          <Star
            key={i}
            className={`h-4 w-4 ${
              filled
                ? 'text-[color:var(--color-accent)]'
                : 'text-slate-500/80'
            }`}
            fill={filled ? 'currentColor' : 'none'}
          />
        );
      })}
    </div>
  );
}

export default function StudentFeedbackPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [rows, setRows] = useState<RowVM[]>([]);
  const [total, setTotal] = useState(0);

  // ✅ NEW: average rating (only students that rated > 0)
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingsCount, setRatingsCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // pagination (25 per page)
  const pageSize = 25;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // ✅ NEW reset
    setAvgRating(null);
    setRatingsCount(0);
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setRows([]);
      setTotal(0);
      setAvgRating(null);
      setRatingsCount(0);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // 1) load students (paged)
        const studentsRes = await supabase
          .from('students')
          .select('id, full_name', { count: 'exact' })
          .eq('school_id', schoolId)
          .order('full_name', { ascending: true })
          .range(from, to);

        if (studentsRes.error) {
          console.error(studentsRes.error);
          setError('Αποτυχία φόρτωσης μαθητών.');
          setRows([]);
          setTotal(0);
          return;
        }

        const students = (studentsRes.data ?? []) as StudentMiniRow[];
        const totalCount = studentsRes.count ?? 0;
        setTotal(totalCount);

        // ✅ 1.5) avg rating (only ratings > 0)
        // NOTE: This loads only rating values so we can compute avg reliably
        const avgRes = await supabase
          .from(FEEDBACK_TABLE)
          .select('rating', { count: 'exact' })
          .eq('school_id', schoolId)
          .gt('rating', 0);

        if (avgRes.error) {
          console.error(avgRes.error);
          setAvgRating(null);
          setRatingsCount(0);
        } else {
          const ratings = (avgRes.data ?? [])
            .map((x: any) => Number(x.rating))
            .filter((n: number) => Number.isFinite(n) && n > 0);

          const count = avgRes.count ?? ratings.length;
          setRatingsCount(count);

          if (ratings.length === 0) {
            setAvgRating(null);
          } else {
            const sum = ratings.reduce((a, b) => a + b, 0);
            setAvgRating(sum / ratings.length);
          }
        }

        const studentIds = students.map((s) => s.id).filter(Boolean);

        // 2) load feedback for these students
        // since DB is UNIQUE(school_id, student_id), there is max 1 row per student
        const feedbackByStudent = new Map<string, FeedbackRow>();

        if (studentIds.length > 0) {
          const fbRes = await supabase
            .from(FEEDBACK_TABLE)
            .select('student_id, rating, feedback, updated_at')
            .eq('school_id', schoolId)
            .in('student_id', studentIds)
            .order('updated_at', { ascending: false });

          if (fbRes.error) {
            console.error(fbRes.error);
            // still show students
          } else {
            const fbs = (fbRes.data ?? []) as FeedbackRow[];
            for (const fb of fbs) {
              if (fb.student_id) feedbackByStudent.set(fb.student_id, fb);
            }
          }
        }

        // 3) merge: ALWAYS show students; if no feedback -> 0 stars + empty feedback
        const merged: RowVM[] = students.map((s) => {
          const fb = feedbackByStudent.get(s.id);
          const rating = clampRating(Number(fb?.rating ?? 0));
          return {
            studentId: s.id,
            fullName: (s.full_name ?? '').trim() || '—',
            rating,
            feedback: (fb?.feedback ?? '').trim(),
            updatedAt: fb?.updated_at ?? null,
          };
        });

        setRows(merged);
      } catch (e) {
        console.error('StudentFeedbackPage load error:', e);
        setError('Αποτυχία φόρτωσης δεδομένων.');
        setRows([]);
        setTotal(0);
        setAvgRating(null);
        setRatingsCount(0);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schoolId, page]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-slate-50">
            <MessageSquareText
              className="h-4 w-4"
              style={{ color: 'var(--color-accent)' }}
            />
            Feedback μαθητών
          </h1>
          <p className="text-xs text-slate-300">
            Αξιολογήσεις (0-5 αστέρια) και σχόλια που αφήνουν οι μαθητές για το
            φροντιστήριο.
          </p>

          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο μαθητών:{' '}
              <span className="font-medium text-slate-100">{total}</span>
            </p>
          )}

          {/* ✅ NEW: average stars card */}
          {schoolId && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/25 px-3 py-2">
                <div className="text-[11px] text-slate-300">Μέση αξιολόγηση</div>

                {avgRating == null ? (
                  <div className="mt-1 text-xs text-slate-200">—</div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    {/* show rounded stars but also numeric avg */}
                    <Stars value={Math.round(avgRating)} />
                    <span className="text-xs font-semibold text-slate-50">
                      {avgRating.toFixed(2)} / 5
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({ratingsCount} αξιολογήσεις)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-900/40 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!schoolId && (
        <div className="rounded border border-amber-500 bg-amber-900/40 px-4 py-2 text-xs text-amber-100">
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* Table wrapper — same styling as StudentsPage */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-4 text-xs text-slate-300">Φόρτωση…</div>
          ) : total === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν υπάρχουν μαθητές.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-700 px-4 py-2 text-left">
                    Ονοματεπώνυμο
                  </th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">
                    Αξιολόγηση
                  </th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">
                    Feedback
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg =
                    absoluteIndex % 2 === 0
                      ? 'bg-slate-950/45'
                      : 'bg-slate-900/25';

                  return (
                    <tr
                      key={r.studentId}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span
                          className="text-xs font-medium"
                          style={{ color: 'var(--color-text-td)' }}
                        >
                          {r.fullName}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <Stars value={r.rating} />
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <div className="max-w-[780px] whitespace-pre-wrap text-slate-200/90">
                          {r.feedback.trim() ? r.feedback : '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{total}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Προηγ.
              </button>

              <div className="rounded-md border border-slate-700 bg-slate-900/20 px-3 py-1.5 text-[11px] text-slate-200">
                Σελίδα <span className="text-slate-50">{page}</span> /{' '}
                <span className="text-slate-50">{pageCount}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Επόμ.
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
