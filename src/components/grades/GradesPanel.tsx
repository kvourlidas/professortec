import { useMemo } from 'react';
import { BarChart3, ClipboardCheck, TrendingUp, Trophy, LayoutGrid, BookOpen } from 'lucide-react';
import StudentGradesChart from './StudentGradesChart';
import GradesTable from './GradesTable';
import StyledSelect from '../ui/StyledSelect';
import FolderTabs from '../ui/FolderTabs';
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
            <FolderTabs
              isDark={isDark}
              active={activeTab}
              onChange={(t) => { onTabChange(t); if (t === 'overall') onSubjectChange(null); }}
              tabs={[
                { key: 'overall' as GradesTab, label: 'Γενικά', icon: LayoutGrid },
                { key: 'by-subject' as GradesTab, label: 'Ανά μάθημα', icon: BookOpen },
              ]}
            />
            {activeTab === 'by-subject' && (
              subjectOptions.length > 0
                ? <StyledSelect
                    isDark={isDark} showChevron className={`${subjectSelectCls} pr-7`}
                    value={selectedSubjectId ?? subjectOptions[0]?.id ?? ''}
                    onChange={(v) => onSubjectChange(v || null)}
                    options={subjectOptions.map((opt) => ({ value: opt.id, label: opt.name }))}
                  />
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
