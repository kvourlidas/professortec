import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { BarChart3, GraduationCap, Search, Users } from 'lucide-react';
import type { StudentRow, TutorRow, StudentGradeRow, TutorGradeRow, GradeRow, GradesTab, SelectionType } from '../components/grades/types';
import { getScrollbarStyle } from '../components/grades/utils';
import GradesPanel from '../components/grades/GradesPanel';

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const GradesPage = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loadingTutors, setLoadingTutors] = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [listType, setListType] = useState<'students' | 'tutors'>('students');
  const [search, setSearch] = useState('');
  const [selectionType, setSelectionType] = useState<SelectionType>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<TutorRow | null>(null);

  // ── Grades ────────────────────────────────────────────────────────────────
  const [studentGrades, setStudentGrades] = useState<StudentGradeRow[]>([]);
  const [loadingStudentGrades, setLoadingStudentGrades] = useState(false);
  const [tutorGrades, setTutorGrades] = useState<TutorGradeRow[]>([]);
  const [loadingTutorGrades, setLoadingTutorGrades] = useState(false);
  const [activeTab, setActiveTab] = useState<GradesTab>('overall');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // ── Load lists ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.school_id) return;
    setLoadingStudents(true);
    supabase.from('students').select('id, school_id, full_name, email').eq('school_id', profile.school_id).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (!error) setStudents(data ?? []); setLoadingStudents(false); });
    setLoadingTutors(true);
    supabase.from('tutors').select('id, school_id, full_name, email').eq('school_id', profile.school_id).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (!error) setTutors(data ?? []); setLoadingTutors(false); });
  }, [profile?.school_id]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = listType === 'students' ? students : tutors;
    return q ? list.filter((i) => i.full_name.toLowerCase().includes(q)) : list;
  }, [listType, students, tutors, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectStudent = async (student: StudentRow) => {
    if (!profile?.school_id) return;
    setSelectionType('student'); setSelectedStudent(student); setSelectedTutor(null);
    setActiveTab('overall'); setSelectedSubjectId(null);
    setLoadingStudentGrades(true); setStudentGrades([]);
    const { data, error } = await supabase.from('student_test_grades')
      .select('id, student_id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, graded_at')
      .eq('school_id', profile.school_id).eq('student_id', student.id).order('test_date', { ascending: false });
    if (!error) setStudentGrades((data ?? []) as StudentGradeRow[]);
    setLoadingStudentGrades(false);
  };

  const handleSelectTutor = async (tutor: TutorRow) => {
    if (!profile?.school_id) return;
    setSelectionType('tutor'); setSelectedTutor(tutor); setSelectedStudent(null);
    setActiveTab('overall'); setSelectedSubjectId(null);
    setLoadingTutorGrades(true); setTutorGrades([]);
    const { data, error } = await supabase.from('tutor_test_grades')
      .select('id, school_id, tutor_id, tutor_name, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, students_count')
      .eq('school_id', profile.school_id).eq('tutor_id', tutor.id).order('test_date', { ascending: false });
    if (!error) setTutorGrades((data ?? []) as TutorGradeRow[]);
    setLoadingTutorGrades(false);
  };

  const handleSwitchType = (type: 'students' | 'tutors') => {
    if (type === listType) return;
    setListType(type);
    setSearch('');
    setSelectionType(null);
    setSelectedStudent(null);
    setSelectedTutor(null);
    setStudentGrades([]);
    setTutorGrades([]);
  };

  // ── Derived grade data ────────────────────────────────────────────────────
  const currentGrades: GradeRow[] = useMemo(() => {
    if (selectionType === 'student') return studentGrades;
    if (selectionType === 'tutor') return tutorGrades;
    return [];
  }, [selectionType, studentGrades, tutorGrades]);

  const loadingCurrentGrades = selectionType === 'student' ? loadingStudentGrades
    : selectionType === 'tutor' ? loadingTutorGrades : false;

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of currentGrades) {
      if (g.subject_id && g.subject_name && !map.has(g.subject_id)) map.set(g.subject_id, g.subject_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [currentGrades]);

  useEffect(() => {
    if (activeTab !== 'by-subject' || selectedSubjectId || !subjectOptions.length) return;
    setSelectedSubjectId(subjectOptions[0].id);
  }, [activeTab, subjectOptions, selectedSubjectId]);

  const visibleGrades = useMemo(() => {
    if (activeTab === 'overall') return currentGrades;
    if (!selectedSubjectId) return [];
    return currentGrades.filter((g) => g.subject_id === selectedSubjectId);
  }, [currentGrades, activeTab, selectedSubjectId]);

  const gradesForChart = useMemo(() =>
    visibleGrades.map((g) => ({ test_date: g.test_date, grade: g.grade, test_name: g.test_name })),
    [visibleGrades]);

  const { avgGrade, gradedCount } = useMemo(() => {
    const valid = visibleGrades.filter((g) => typeof g.grade === 'number');
    if (!valid.length) return { avgGrade: null as number | null, gradedCount: 0 };
    const sum = valid.reduce((acc, g) => acc + (g.grade ?? 0), 0);
    return { avgGrade: sum / valid.length, gradedCount: valid.length };
  }, [visibleGrades]);

  // ── Derived display ───────────────────────────────────────────────────────
  const loadingList = listType === 'students' ? loadingStudents : loadingTutors;
  const totalCount = listType === 'students' ? students.length : tutors.length;

  return (
    <div className="space-y-5 px-1">
      <style>{getScrollbarStyle(isDark)}</style>

      {/* ── Top card ── */}
      <div className={`overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md ${
        isDark ? 'border-slate-700/50 bg-slate-950/40' : 'border-slate-200 bg-white/80'
      }`}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Row 1: title left, toggle right */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
            </div>
            <div>
              <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Βαθμοί</h1>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Δες την πορεία βαθμών για μαθητές και καθηγητές.
              </p>
            </div>
          </div>

          {/* Students / Tutors toggle */}
          <div className={`flex overflow-hidden rounded-xl border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
            {([
              { key: 'students' as const, label: 'Μαθητές', icon: <Users className="h-3.5 w-3.5" />, count: students.length },
              { key: 'tutors' as const, label: 'Καθηγητές', icon: <GraduationCap className="h-3.5 w-3.5" />, count: tutors.length },
            ] as const).map(({ key, label, icon, count }) => {
              const active = listType === key;
              return (
                <button key={key} type="button" onClick={() => handleSwitchType(key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                    active
                      ? isDark ? 'bg-slate-900/60 text-white' : 'bg-white text-slate-900'
                      : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]' : 'text-slate-400 bg-slate-50 hover:text-slate-600'
                  }`}
                >
                  <span style={active ? { color: 'var(--color-accent)' } : undefined}>{icon}</span>
                  {label}
                  {count > 0 && (
                    <span className="rounded-full px-1.5 py-px text-[10px] tabular-nums"
                      style={active
                        ? { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }
                        : { background: isDark ? 'rgb(30 41 59)' : 'rgb(241 245 249)', color: isDark ? 'rgb(100 116 139)' : 'rgb(100 116 139)' }
                      }>
                      {count}
                    </span>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: active ? 'var(--color-accent)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: full-width search */}
        <div className={`border-t px-5 py-3 ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={listType === 'students' ? 'Αναζήτηση μαθητή…' : 'Αναζήτηση καθηγητή…'}
              className={`h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none transition ${
                isDark
                  ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                  : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
              }`}
            />
          </div>
        </div>

        {/* Row 3: always-visible list */}
        <div className={`border-t ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
          {loadingList ? (
            <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className={`h-7 w-7 shrink-0 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
                    style={{ width: `${40 + (i * 17) % 35}%` }} />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={`px-5 py-6 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Δεν βρέθηκαν αποτελέσματα.
            </div>
          ) : (
            <div className={`max-h-[220px] overflow-y-auto grades-scroll divide-y ${isDark ? 'divide-slate-800/40' : 'divide-slate-100'}`}>
              {filteredItems.map((item) => {
                const isSelected = listType === 'students'
                  ? item.id === selectedStudent?.id
                  : item.id === selectedTutor?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => listType === 'students'
                      ? handleSelectStudent(item as StudentRow)
                      : handleSelectTutor(item as TutorRow)
                    }
                    className={`group relative flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? isDark ? 'bg-white/[0.06]' : 'bg-slate-100'
                        : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full"
                        style={{ background: 'var(--color-accent)' }} />
                    )}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={isSelected
                        ? { background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }
                        : { background: isDark ? 'rgb(30 41 59)' : 'rgb(241 245 249)', color: isDark ? 'rgb(100 116 139)' : 'rgb(100 116 139)' }
                      }>
                      {getInitials(item.full_name)}
                    </span>
                    <span className={`flex-1 truncate text-[13px] font-medium ${
                      isSelected
                        ? isDark ? 'text-white' : 'text-slate-900'
                        : isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-800'
                    }`}>
                      {item.full_name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer count */}
          <div className={`border-t px-5 py-1.5 ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
            <span className={`text-[11px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              {search.trim() ? `${filteredItems.length} / ${totalCount}` : totalCount}{' '}
              {listType === 'students' ? 'μαθητές' : 'καθηγητές'} σύνολο
            </span>
          </div>
        </div>
      </div>

      {/* ── Grades panel (full width) ── */}
      <GradesPanel
        selectionType={selectionType}
        selectedStudent={selectedStudent}
        selectedTutor={selectedTutor}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedSubjectId={selectedSubjectId}
        onSubjectChange={setSelectedSubjectId}
        subjectOptions={subjectOptions}
        grades={visibleGrades}
        loading={loadingCurrentGrades}
        avgGrade={avgGrade}
        gradedCount={gradedCount}
        gradesForChart={gradesForChart}
        isDark={isDark}
      />
    </div>
  );
};

export default GradesPage;
