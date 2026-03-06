import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { BarChart3, Users, GraduationCap } from 'lucide-react';
import type { StudentRow, TutorRow, StudentGradeRow, TutorGradeRow, GradeRow, GradesTab, SelectionType } from '../components/grades/types';
import { getScrollbarStyle } from '../components/grades/utils';
import GradesListCard from '../components/grades/GradesListCard';
import GradesPanel from '../components/grades/GradesPanel';

const GradesPage = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loadingTutors, setLoadingTutors] = useState(false);
  const [tutorSearch, setTutorSearch] = useState('');
  const [selectionType, setSelectionType] = useState<SelectionType>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<TutorRow | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentGradeRow[]>([]);
  const [loadingStudentGrades, setLoadingStudentGrades] = useState(false);
  const [tutorGrades, setTutorGrades] = useState<TutorGradeRow[]>([]);
  const [loadingTutorGrades, setLoadingTutorGrades] = useState(false);
  const [activeTab, setActiveTab] = useState<GradesTab>('overall');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.school_id) return;
    const loadStudents = async () => {
      setLoadingStudents(true);
      const { data, error } = await supabase.from('students').select('id, school_id, full_name, email').eq('school_id', profile.school_id).order('full_name', { ascending: true });
      if (!error) setStudents(data ?? []);
      setLoadingStudents(false);
    };
    const loadTutors = async () => {
      setLoadingTutors(true);
      const { data, error } = await supabase.from('tutors').select('id, school_id, full_name, email').eq('school_id', profile.school_id).order('full_name', { ascending: true });
      if (!error) setTutors(data ?? []);
      setLoadingTutors(false);
    };
    loadStudents(); loadTutors();
  }, [profile?.school_id]);

  const filteredStudents = useMemo(() => { const q = studentSearch.trim().toLowerCase(); return q ? students.filter((s) => s.full_name.toLowerCase().includes(q)) : students; }, [students, studentSearch]);
  const filteredTutors = useMemo(() => { const q = tutorSearch.trim().toLowerCase(); return q ? tutors.filter((t) => t.full_name.toLowerCase().includes(q)) : tutors; }, [tutors, tutorSearch]);

  const handleSelectStudent = async (student: StudentRow) => {
    if (!profile?.school_id) return;
    setSelectionType('student'); setSelectedStudent(student); setSelectedTutor(null); setActiveTab('overall'); setSelectedSubjectId(null); setLoadingStudentGrades(true); setStudentGrades([]);
    const { data, error } = await supabase.from('student_test_grades').select('id, student_id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, graded_at').eq('school_id', profile.school_id).eq('student_id', student.id).order('test_date', { ascending: false });
    if (!error) setStudentGrades((data ?? []) as StudentGradeRow[]);
    setLoadingStudentGrades(false);
  };

  const handleSelectTutor = async (tutor: TutorRow) => {
    if (!profile?.school_id) return;
    setSelectionType('tutor'); setSelectedTutor(tutor); setSelectedStudent(null); setActiveTab('overall'); setSelectedSubjectId(null); setLoadingTutorGrades(true); setTutorGrades([]);
    const { data, error } = await supabase.from('tutor_test_grades').select('id, school_id, tutor_id, tutor_name, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, students_count').eq('school_id', profile.school_id).eq('tutor_id', tutor.id).order('test_date', { ascending: false });
    if (!error) setTutorGrades((data ?? []) as TutorGradeRow[]);
    setLoadingTutorGrades(false);
  };

  const currentGrades: GradeRow[] = useMemo(() => {
    if (selectionType === 'student') return studentGrades;
    if (selectionType === 'tutor') return tutorGrades;
    return [];
  }, [selectionType, studentGrades, tutorGrades]);

  const loadingCurrentGrades = selectionType === 'student' ? loadingStudentGrades : selectionType === 'tutor' ? loadingTutorGrades : false;

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of currentGrades) { if (g.subject_id && g.subject_name && !map.has(g.subject_id)) map.set(g.subject_id, g.subject_name); }
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

  const gradesForChart = useMemo(() => visibleGrades.map((g) => ({ test_date: g.test_date, grade: g.grade, test_name: g.test_name })), [visibleGrades]);

  const { avgGrade, gradedCount } = useMemo(() => {
    const valid = visibleGrades.filter((g) => typeof g.grade === 'number');
    if (!valid.length) return { avgGrade: null as number | null, gradedCount: 0 };
    const sum = valid.reduce((acc, g) => acc + (g.grade ?? 0), 0);
    return { avgGrade: sum / valid.length, gradedCount: valid.length };
  }, [visibleGrades]);

  return (
    <div className="space-y-6 px-1">
      <style>{getScrollbarStyle(isDark)}</style>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <BarChart3 className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
        </div>
        <div>
          <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Βαθμοί</h1>
          <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δες την πορεία βαθμών για μαθητές και καθηγητές.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* LEFT: Students + Tutors */}
        <div className="w-full lg:w-[280px] xl:w-[300px] flex flex-col gap-4 shrink-0">
          <GradesListCard
            title="Μαθητές"
            icon={<Users className="h-4 w-4" />}
            search={studentSearch}
            onSearch={setStudentSearch}
            loading={loadingStudents}
            items={filteredStudents}
            onSelect={handleSelectStudent}
            selectedId={selectedStudent?.id}
            isDark={isDark}
          />
          <GradesListCard
            title="Καθηγητές"
            icon={<GraduationCap className="h-4 w-4" />}
            search={tutorSearch}
            onSearch={setTutorSearch}
            loading={loadingTutors}
            items={filteredTutors}
            onSelect={handleSelectTutor}
            selectedId={selectedTutor?.id}
            isDark={isDark}
          />
        </div>

        {/* RIGHT: Grades panel */}
        <div className="w-full flex-1 min-w-0">
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
      </div>
    </div>
  );
};

export default GradesPage;
