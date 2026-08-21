import { formatDate, formatTime } from './utils';
import type { GradeRow } from './types';

interface GradesTableProps {
  loading: boolean;
  grades: GradeRow[];
  isDark: boolean;
}

export default function GradesTable({ loading, grades, isDark }: GradesTableProps) {
  const skeletonDivideCls = 'space-y-3';

  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const trHoverCls = isDark ? 'transition-colors hover:bg-blue-500/[0.12]' : 'transition-colors hover:bg-blue-50';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';

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
    <div className="max-h-[400px] overflow-y-auto grades-scroll">
      <table className="min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10" style={{ background: isDark ? '#0f172a' : '#fff' }}>
          <tr style={{ borderBottom: '2px solid var(--color-accent)' }}>
            <th style={{ width: '1%' }} className={`whitespace-nowrap px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>#</th>
            {['Ημερομηνία', 'Ώρα', 'Διαγώνισμα', 'Μάθημα', 'Τμήμα', 'Βαθμός'].map((h, i, arr) => (
              <th key={h} className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${i < arr.length - 1 ? colDivider : ''} ${isDark ? 'text-white' : 'text-black'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tbodyDivideCls}>
          {grades.map((g, i) => (
            <tr key={g.id} className={trHoverCls}>
              <td className={`whitespace-nowrap px-4 py-2.5 tabular-nums ${colDivider} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{i + 1}</td>
              <td className={`px-4 py-2.5 tabular-nums ${colDivider} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(g.test_date)}</td>
              <td className={`px-4 py-2.5 tabular-nums ${colDivider} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {formatTime(g.start_time)}{g.end_time ? ` – ${formatTime(g.end_time)}` : ''}
              </td>
              <td className={`px-4 py-2.5 font-medium ${colDivider} ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                {g.test_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
              </td>
              <td className={`px-4 py-2.5 ${colDivider} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {g.subject_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
              </td>
              <td className={`px-4 py-2.5 ${colDivider} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {g.class_title ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
              </td>
              <td className={`px-4 py-2.5 tabular-nums font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`} style={g.grade !== null ? { color: 'var(--color-accent)' } : undefined}>
                {g.grade ?? <span className={`font-normal ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
