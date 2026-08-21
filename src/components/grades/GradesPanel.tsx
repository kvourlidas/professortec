import { useMemo } from 'react';
import { BarChart3, ClipboardCheck, TrendingUp, Trophy } from 'lucide-react';
import StudentGradesChart from './StudentGradesChart';
import GradesTable from './GradesTable';
import type { GradeRow, GradesTab, SelectionType, StudentRow, TutorRow } from './types';

interface GradesPanelProps {
  selectionType: SelectionType;
  selectedStudent: StudentRow | null;
  selectedTutor: TutorRow | null;
  activeTab: GradesTab;
  onTabChange: (tab: GradesTab) => void;
  selectedSubjectId: string | null;
  onSubjectChange: (id: string | null) => void;
  subjectOptions: { id: string; name: string }[];
  grades: GradeRow[];
  loading: boolean;
  avgGrade: number | null;
  gradedCount: number;
  gradesForChart: { test_date: string | null; grade: number | null; test_name: string | null }[];
  isDark: boolean;
}

export default function GradesPanel({
  selectionType, selectedStudent, selectedTutor,
  activeTab, onTabChange,
  selectedSubjectId, onSubjectChange, subjectOptions,
  grades, loading,
  avgGrade, gradedCount,
  gradesForChart,
  isDark,
}: GradesPanelProps) {
  const hasSelection = selectionType === 'student' ? !!selectedStudent : selectionType === 'tutor' ? !!selectedTutor : false;

  const headerSubtitle = selectionType === 'student' && selectedStudent
    ? selectedStudent.full_name
    : selectionType === 'tutor' && selectedTutor
      ? selectedTutor.full_name
      : 'Επίλεξε μαθητή ή καθηγητή από αριστερά.';

  const highestGrade = useMemo(() => {
    const valid = grades.filter((g) => typeof g.grade === 'number');
    if (!valid.length) return null;
    return Math.max(...valid.map((g) => g.grade as number));
  }, [grades]);

  const subjectSelectCls = isDark
    ? 'h-8 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]'
    : 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[color:var(--color-accent)]';

  const statLabelCls = `flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
    isDark ? 'text-slate-500' : 'text-slate-400'
  }`;

  const colDivideCls = isDark ? 'divide-slate-800' : 'divide-slate-200';

  return (
    <div>
      {/* Header — accent underline, no card chrome */}
      <div className="flex shrink-0 items-center gap-2.5 pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <BarChart3 className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
            {selectionType === 'student' ? 'Βαθμοί μαθητή' : selectionType === 'tutor' ? 'Βαθμοί καθηγητή' : 'Βαθμοί'}
          </h2>
          <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{headerSubtitle}</p>
        </div>
      </div>

      {!hasSelection ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <BarChart3 className={`h-10 w-10 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Δεν έχει επιλεγεί κανείς</p>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επίλεξε μαθητή ή καθηγητή από τα αριστερά.</p>
          </div>
        </div>
      ) : (
        <div className="pt-5 space-y-5">
          {/* Tabs + subject select */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(['overall', 'by-subject'] as GradesTab[]).map((tab) => {
                const active = activeTab === tab;
                const label = tab === 'overall' ? 'Γενικά' : 'Ανά μάθημα';
                return (
                  <button key={tab} type="button"
                    onClick={() => { onTabChange(tab); if (tab === 'overall') onSubjectChange(null); }}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                    style={active
                      ? { backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--color-input-bg)' }
                      : { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : 'rgb(203 213 225)', color: isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }
                    }>
                    {label}
                  </button>
                );
              })}
            </div>
            {activeTab === 'by-subject' && (
              subjectOptions.length > 0
                ? <select value={selectedSubjectId ?? subjectOptions[0]?.id ?? ''} onChange={(e) => onSubjectChange(e.target.value || null)} className={subjectSelectCls}>
                    {subjectOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                  </select>
                : <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα με βαθμούς.</span>
            )}
          </div>

          {/* Stats — flat labeled columns, matching the rest of the app */}
          {!loading && gradedCount > 0 && (
            <div className={`grid grid-cols-3 divide-x ${colDivideCls}`}>
              <div className="flex flex-col gap-1.5 pr-4">
                <span className={statLabelCls}><ClipboardCheck className="h-3 w-3" />Διαγωνίσματα</span>
                <p className={`text-2xl font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{gradedCount}</p>
              </div>
              <div className="flex flex-col gap-1.5 px-4">
                <span className={statLabelCls}><TrendingUp className="h-3 w-3" />Μ.Ο. Βαθμών</span>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {avgGrade !== null ? avgGrade.toFixed(1) : '—'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pl-4">
                <span className={statLabelCls}><Trophy className="h-3 w-3" />Υψηλότερος</span>
                <p className={`text-2xl font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {highestGrade !== null ? highestGrade : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          <StudentGradesChart grades={gradesForChart} loading={loading} />

          {/* Table */}
          <GradesTable loading={loading} grades={grades} isDark={isDark} />
        </div>
      )}
    </div>
  );
}
