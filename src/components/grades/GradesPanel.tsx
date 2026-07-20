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

  const statCardCls = `rounded-xl border p-3 ${
    isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'
  }`;

  const statLabelCls = `text-[10px] font-medium uppercase tracking-wider ${
    isDark ? 'text-slate-500' : 'text-slate-400'
  }`;

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
        : 'border-slate-200 bg-white/80 ring-black/[0.02]'
    }`}>
      {/* Panel header */}
      <div className="flex shrink-0 items-center gap-3 px-5 py-3" style={{ background: 'var(--ch-bg)', borderBottom: '1px solid var(--ch-divider)' }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
          <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--ch-icon)' }} />
        </div>
        <div>
          <h2 className="text-xs font-semibold" style={{ color: 'var(--ch-text)' }}>
            {selectionType === 'student' ? 'Βαθμοί μαθητή' : selectionType === 'tutor' ? 'Βαθμοί καθηγητή' : 'Βαθμοί'}
          </h2>
          <p className="text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>{headerSubtitle}</p>
        </div>
      </div>

      {!hasSelection ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
            <BarChart3 className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Δεν έχει επιλεγεί κανείς</p>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επίλεξε μαθητή ή καθηγητή από τα αριστερά.</p>
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
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

          {/* Stat cards */}
          {!loading && gradedCount > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className={statCardCls}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ClipboardCheck className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <p className={statLabelCls}>Διαγωνίσματα</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{gradedCount}</p>
              </div>
              <div className={statCardCls}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <p className={statLabelCls}>Μ.Ο. Βαθμών</p>
                </div>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {avgGrade !== null ? avgGrade.toFixed(1) : '—'}
                </p>
              </div>
              <div className={statCardCls}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Trophy className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <p className={statLabelCls}>Υψηλότερος</p>
                </div>
                <p className={`text-xl font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
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
