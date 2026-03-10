import { BarChart3 } from 'lucide-react';
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

  const avgBoxTitle = selectionType === 'tutor'
    ? (activeTab === 'overall' ? 'Μέσος όρος επίδοσης (όλα τα μαθήματα)' : 'Μέσος όρος επίδοσης στο επιλεγμένο μάθημα')
    : (activeTab === 'overall' ? 'Μέσος όρος βαθμών (όλα τα μαθήματα)' : 'Μέσος όρος στο επιλεγμένο μάθημα');

  const panelCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const panelHeaderCls = isDark
    ? 'flex items-center gap-3 border-b border-slate-800/70 bg-slate-900/30 px-5 py-3.5'
    : 'flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5';

  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const avgBoxCls = isDark
    ? 'flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3'
    : 'flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

  const subjectSelectCls = isDark
    ? 'h-8 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]'
    : 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[color:var(--color-accent)]';

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
        : 'border-slate-200 bg-white/80 ring-black/[0.02]'
    }`}>
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      {/* Panel header */}
      <div className={panelHeaderCls}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
          <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <h2 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {selectionType === 'student' ? 'Βαθμοί μαθητή' : selectionType === 'tutor' ? 'Βαθμοί καθηγητή' : 'Βαθμοί'}
          </h2>
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{headerSubtitle}</p>
        </div>
      </div>

      {!hasSelection ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <div className={emptyBoxCls}>
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
                      ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', color: 'var(--color-accent)' }
                      : { backgroundColor: isDark ? 'transparent' : '#f8fafc', borderColor: isDark ? 'rgb(71 85 105 / 0.5)' : 'rgb(203 213 225)', color: isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }
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

          {/* Chart */}
          <StudentGradesChart grades={gradesForChart} loading={loading} />

          {/* Average box */}
          {!loading && grades.length > 0 && (
            <div className={avgBoxCls}>
              <div>
                <p className={`text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{avgBoxTitle}</p>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Βασισμένος σε {gradedCount} διαγωνίσματα</p>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {avgGrade !== null ? avgGrade.toFixed(1) : '—'}
              </div>
            </div>
          )}

          {/* Table */}
          <GradesTable loading={loading} grades={grades} isDark={isDark} />
        </div>
      )}
    </div>
  );
}