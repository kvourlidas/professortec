import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Check, ChevronDown, GraduationCap, Search, User, Users, X } from 'lucide-react';
import type { StudentRow, TutorRow, StudentGradeRow, TutorGradeRow, GradeRow, GradesTab, SelectionType, GradesDateFilterMode, SchoolYearOption } from '../components/grades/types';
import GradesPanel from '../components/grades/GradesPanel';

function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const STYLE = `
  @keyframes gradesFadeSlide {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .grades-drop-animate { animation: gradesFadeSlide 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }
`;

const GradesPage = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isPrivateLessons = profile?.account_type === 'idiaiterou';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);

  // ── Selector state ────────────────────────────────────────────────────────
  const [listType, setListType] = useState<'students' | 'tutors'>('students');
  const [dropOpen, setDropOpen] = useState(false);
  const [dropSearch, setDropSearch] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const dropSearchRef = useRef<HTMLInputElement>(null);

  // ── Selection ─────────────────────────────────────────────────────────────
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

  // ── Date filter ───────────────────────────────────────────────────────────
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [dateFilterMode, setDateFilterMode] = useState<GradesDateFilterMode>('all');
  const [filterMonthValue, setFilterMonthValue] = useState<string>('');
  const [filterYearId, setFilterYearId] = useState<string>('');
  const [filterRangeStart, setFilterRangeStart] = useState<string>('');
  const [filterRangeEnd, setFilterRangeEnd] = useState<string>('');

  // ── Load lists ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from('students').select('id, school_id, full_name, email').eq('school_id', profile.school_id).is('deleted_at', null).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (!error) setStudents(data ?? []); });
    if (isPrivateLessons) return;
    supabase.from('tutors').select('id, school_id, full_name, email').eq('school_id', profile.school_id).is('deleted_at', null).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (!error) setTutors(data ?? []); });
  }, [profile?.school_id, isPrivateLessons]);

  useEffect(() => {
    if (!profile?.school_id) return;
    supabase.from('school_years').select('id,name,start_date,end_date,is_summer').eq('school_id', profile.school_id).order('start_date', { ascending: false })
      .then(({ data, error }) => { if (!error) setSchoolYears((data ?? []) as SchoolYearOption[]); });
  }, [profile?.school_id]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Focus search when dropdown opens ─────────────────────────────────────
  useEffect(() => {
    if (dropOpen) setTimeout(() => dropSearchRef.current?.focus(), 30);
    else setDropSearch('');
  }, [dropOpen]);

  // ── Filtered dropdown list ────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = dropSearch.trim().toLowerCase();
    const list = listType === 'students' ? students : tutors;
    return q ? list.filter((i) => i.full_name.toLowerCase().includes(q)) : list;
  }, [listType, students, tutors, dropSearch]);

  // ── Selected display ──────────────────────────────────────────────────────
  const selectedItem = listType === 'students' ? selectedStudent : selectedTutor;
  const totalCount = listType === 'students' ? students.length : tutors.length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectStudent = async (student: StudentRow) => {
    setDropOpen(false);
    if (!profile?.school_id) return;
    setSelectionType('student'); setSelectedStudent(student); setSelectedTutor(null);
    setActiveTab('overall'); setSelectedSubjectId(null);
    setDateFilterMode('all'); setFilterMonthValue(''); setFilterYearId(''); setFilterRangeStart(''); setFilterRangeEnd('');
    setLoadingStudentGrades(true); setStudentGrades([]);
    const { data, error } = await supabase.from('student_test_grades')
      .select('id, student_id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, graded_at')
      .eq('school_id', profile.school_id).eq('student_id', student.id).order('test_date', { ascending: false });
    if (!error) setStudentGrades((data ?? []) as StudentGradeRow[]);
    setLoadingStudentGrades(false);
  };

  const handleSelectTutor = async (tutor: TutorRow) => {
    setDropOpen(false);
    if (!profile?.school_id) return;
    setSelectionType('tutor'); setSelectedTutor(tutor); setSelectedStudent(null);
    setActiveTab('overall'); setSelectedSubjectId(null);
    setDateFilterMode('all'); setFilterMonthValue(''); setFilterYearId(''); setFilterRangeStart(''); setFilterRangeEnd('');
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
    setDropOpen(false);
    setDropSearch('');
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

  // ── Month options available for the currently selected student/tutor ──────
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const g of currentGrades) {
      if (g.test_date) set.add(g.test_date.slice(0, 7));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [currentGrades]);

  // Effective selection: falls back to the first available option until the
  // user explicitly picks one, without needing a setState-in-effect sync.
  const effectiveFilterMonthValue = filterMonthValue || monthOptions[0] || '';
  const effectiveFilterYearId = filterYearId || schoolYears[0]?.id || '';

  // ── Date-range filter (month / school year / custom range) ────────────────
  const dateFilteredGrades = useMemo(() => {
    if (dateFilterMode === 'month') {
      if (!effectiveFilterMonthValue) return visibleGrades;
      return visibleGrades.filter((g) => g.test_date?.slice(0, 7) === effectiveFilterMonthValue);
    }
    if (dateFilterMode === 'schoolYear') {
      const year = schoolYears.find((y) => y.id === effectiveFilterYearId);
      if (!year) return visibleGrades;
      return visibleGrades.filter((g) => g.test_date && g.test_date >= year.start_date && g.test_date <= year.end_date);
    }
    if (dateFilterMode === 'range') {
      const startISO = parseDateDisplayToISO(filterRangeStart);
      const endISO = parseDateDisplayToISO(filterRangeEnd);
      if (!startISO && !endISO) return visibleGrades;
      return visibleGrades.filter((g) => {
        if (!g.test_date) return false;
        if (startISO && g.test_date < startISO) return false;
        if (endISO && g.test_date > endISO) return false;
        return true;
      });
    }
    return visibleGrades;
  }, [visibleGrades, dateFilterMode, effectiveFilterMonthValue, effectiveFilterYearId, schoolYears, filterRangeStart, filterRangeEnd]);

  const gradesForChart = useMemo(() =>
    dateFilteredGrades.map((g) => ({ test_date: g.test_date, grade: g.grade, test_name: g.test_name })),
    [dateFilteredGrades]);

  const { avgGrade, gradedCount } = useMemo(() => {
    const valid = dateFilteredGrades.filter((g) => typeof g.grade === 'number');
    if (!valid.length) return { avgGrade: null as number | null, gradedCount: 0 };
    const sum = valid.reduce((acc, g) => acc + (g.grade ?? 0), 0);
    return { avgGrade: sum / valid.length, gradedCount: valid.length };
  }, [dateFilteredGrades]);

  return (
    <div className="space-y-5 px-1">
      <style>{STYLE}</style>

      {/* ── Top section ── */}
      <div className="space-y-3">

        {/* Students / Tutors toggle */}
        {!isPrivateLessons && (
          <div className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {([
              { key: 'students' as const, label: 'Μαθητές',    icon: <Users className="h-3.5 w-3.5" /> },
              { key: 'tutors'   as const, label: 'Καθηγητές',  icon: <GraduationCap className="h-3.5 w-3.5" /> },
            ] as const).map(({ key, label, icon }) => {
              const active = listType === key;
              return (
                <button key={key} type="button" onClick={() => handleSwitchType(key)}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? isDark
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-800 shadow-sm'
                      : isDark
                        ? 'text-slate-500 hover:text-slate-300'
                        : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span style={active ? { color: 'var(--color-accent)' } : undefined}>{icon}</span>
                  <span style={active ? { color: 'var(--color-accent)' } : undefined}>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dropdown selector */}
        <div ref={dropRef} className="relative z-30">

          {/* Trigger */}
          <button
            type="button"
            onClick={() => { setDropOpen((v) => !v); setDropSearch(''); }}
            className={`group flex w-full items-center gap-4 rounded-2xl px-5 py-3.5 text-left shadow-md transition-all ${
              isDark
                ? 'border border-slate-700 bg-slate-900 hover:border-slate-600'
                : 'border border-slate-200 bg-white hover:border-slate-300'
            } ${dropOpen
                ? isDark
                  ? 'border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/25'
                  : 'border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/15'
                : ''
            }`}
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm transition-all"
              style={{
                background: selectedItem
                  ? 'var(--color-accent)'
                  : isDark ? '#1e293b' : '#f1f5f9',
                border: selectedItem
                  ? '1px solid var(--color-accent)'
                  : isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                color: selectedItem ? 'var(--color-input-bg)' : isDark ? '#64748b' : '#94a3b8',
              }}>
              {selectedItem
                ? (selectedItem.full_name ?? '?').charAt(0).toUpperCase()
                : <User className="h-4 w-4" />}
            </div>

            {/* Name / placeholder */}
            <div className="min-w-0 flex-1">
              {selectedItem ? (
                <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                  {selectedItem.full_name ?? '—'}
                </div>
              ) : (
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {listType === 'students' ? 'Επίλεξε μαθητή…' : 'Επίλεξε καθηγητή…'}
                </span>
              )}
            </div>

            {/* Count badge + chevron */}
            <div className="flex shrink-0 items-center gap-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums ${
                isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'
              }`}>
                {totalCount}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${dropOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
          </button>

          {/* Dropdown panel */}
          {dropOpen && (
            <div className={`grades-drop-animate absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl shadow-2xl ${
              isDark
                ? 'border border-slate-700 bg-slate-900'
                : 'border border-slate-200 bg-white'
            }`}>

              {/* Search */}
              <div className={`px-3 pt-3 pb-2.5 ${isDark ? 'border-b border-slate-800/60' : 'border-b border-slate-100'}`}>
                <div className="relative">
                  <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    ref={dropSearchRef}
                    value={dropSearch}
                    onChange={(e) => setDropSearch(e.target.value)}
                    placeholder={listType === 'students' ? 'Αναζήτηση μαθητή…' : 'Αναζήτηση καθηγητή…'}
                    className={`h-9 w-full rounded-xl pl-9 pr-8 text-xs outline-none transition-all ${
                      isDark
                        ? 'border border-slate-700/50 bg-slate-800/70 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                        : 'border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/50 focus:bg-white'
                    }`}
                  />
                  {dropSearch && (
                    <button type="button" onClick={() => setDropSearch('')}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="grades-drop-list max-h-64 overflow-y-auto py-1.5">
                {filteredItems.length === 0 ? (
                  <div className={`px-4 py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Δεν βρέθηκαν αποτελέσματα.
                  </div>
                ) : filteredItems.map((item) => {
                  const active = item.id === selectedItem?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => listType === 'students'
                        ? handleSelectStudent(item as StudentRow)
                        : handleSelectTutor(item as TutorRow)
                      }
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active
                          ? isDark ? 'bg-white/[0.07]' : 'bg-slate-50'
                          : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all"
                        style={active
                          ? { background: 'var(--color-accent)', color: 'var(--color-input-bg)' }
                          : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#64748b' : '#94a3b8' }
                        }>
                        {(item.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold leading-tight ${
                          active ? (isDark ? 'text-slate-50' : 'text-slate-900') : (isDark ? 'text-slate-200' : 'text-slate-700')
                        }`}>
                          {item.full_name ?? '—'}
                        </div>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
        dateFilterMode={dateFilterMode}
        onDateFilterModeChange={setDateFilterMode}
        monthOptions={monthOptions}
        filterMonthValue={effectiveFilterMonthValue}
        onFilterMonthChange={setFilterMonthValue}
        schoolYears={schoolYears}
        filterYearId={effectiveFilterYearId}
        onFilterYearChange={setFilterYearId}
        filterRangeStart={filterRangeStart}
        filterRangeEnd={filterRangeEnd}
        onFilterRangeStartChange={setFilterRangeStart}
        onFilterRangeEndChange={setFilterRangeEnd}
        grades={dateFilteredGrades}
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
