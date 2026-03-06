import { formatDate, formatTime } from './utils';
import type { GradeRow } from './types';

interface GradesTableProps {
  loading: boolean;
  grades: GradeRow[];
  isDark: boolean;
}

export default function GradesTable({ loading, grades, isDark }: GradesTableProps) {
  const skeletonDivideCls = isDark
    ? 'divide-y divide-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden'
    : 'divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden';

  const gradesTableWrapCls = isDark
    ? 'overflow-hidden rounded-xl border border-slate-700/50'
    : 'overflow-hidden rounded-xl border border-slate-200';

  const theadRowCls = isDark
    ? 'border-b border-slate-700/60 bg-slate-900/80 backdrop-blur'
    : 'border-b border-slate-200 bg-slate-50';

  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';

  if (loading) {
    return (
      <div className={skeletonDivideCls}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-3.5 animate-pulse">
            <div className={`h-3 w-1/5 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200/70'}`} />
            <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δεν υπάρχουν βαθμοί</p>
        <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>για τα επιλεγμένα κριτήρια.</p>
      </div>
    );
  }

  return (
    <div className={gradesTableWrapCls}>
      <div className="max-h-[400px] overflow-y-auto grades-scroll">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className={theadRowCls}>
              {['Ημερομηνία', 'Ώρα', 'Διαγώνισμα', 'Μάθημα', 'Τμήμα', 'Βαθμός'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tbodyDivideCls}>
            {grades.map((g) => (
              <tr key={g.id} className={trHoverCls}>
                <td className={`px-4 py-2.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(g.test_date)}</td>
                <td className={`px-4 py-2.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {formatTime(g.start_time)}{g.end_time ? ` – ${formatTime(g.end_time)}` : ''}
                </td>
                <td className={`px-4 py-2.5 font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                  {g.test_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                </td>
                <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {g.subject_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                </td>
                <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {g.class_title ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                </td>
                <td className="px-4 py-2.5">
                  {g.grade !== null
                    ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                        {g.grade}
                      </span>
                    : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
