// src/pages/GradesPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { BarChart3, Search, Users, GraduationCap, ChevronRight } from 'lucide-react';
import StudentGradesChart from '../components/grades/StudentGradesChart';

type StudentRow = { id: string; school_id: string; full_name: string; email: string | null };
type TutorRow = { id: string; school_id: string; full_name: string; email: string | null };
type StudentGradeRow = {
    id: string; student_id: string; test_id: string; test_name: string | null;
    test_date: string | null; start_time: string | null; end_time: string | null;
    class_title: string | null; subject_id: string | null; subject_name: string | null;
    grade: number | null; graded_at: string | null;
};
type TutorGradeRow = {
    id: string; school_id: string; tutor_id: string; tutor_name: string | null;
    test_id: string; test_name: string | null; test_date: string | null;
    start_time: string | null; end_time: string | null; class_title: string | null;
    subject_id: string | null; subject_name: string | null;
    grade: number | null; students_count: number | null;
};
type GradesTab = 'overall' | 'by-subject';
type SelectionType = 'student' | 'tutor' | null;

const GradesPage = () => {
    const { profile } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // ── Dynamic classes ──
    const cardCls = isDark
        ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
        : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';
    const cardHeaderCls = isDark
        ? 'flex items-center gap-2.5 border-b border-slate-800/70 bg-slate-900/30 px-4 py-3'
        : 'flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3';
    const listBorderCls = isDark ? 'rounded-lg border border-slate-800/60' : 'rounded-lg border border-slate-200';
    const listDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
    const listSearchCls = isDark
        ? 'h-8 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
        : 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';
    const countBadgeCls = isDark
        ? 'ml-auto inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400'
        : 'ml-auto inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500';
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
    const gradesTableWrapCls = isDark
        ? 'overflow-hidden rounded-xl border border-slate-700/50'
        : 'overflow-hidden rounded-xl border border-slate-200';
    const theadRowCls = isDark
        ? 'border-b border-slate-700/60 bg-slate-900/80 backdrop-blur'
        : 'border-b border-slate-200 bg-slate-50';
    const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
    const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';
    const skeletonDivideCls = isDark
        ? 'divide-y divide-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden'
        : 'divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden';
    const subjectSelectCls = isDark
        ? 'h-8 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]'
        : 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[color:var(--color-accent)]';

    // Scrollbar style — injected once, uses CSS variables for theme awareness
    const scrollbarStyle = `
        .grades-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .grades-scroll::-webkit-scrollbar-track {
            background: ${isDark ? 'rgba(15,23,42,0.4)' : 'rgba(241,245,249,0.8)'};
            border-radius: 99px;
        }
        .grades-scroll::-webkit-scrollbar-thumb {
            background: ${isDark ? 'rgba(100,116,139,0.5)' : 'rgba(148,163,184,0.6)'};
            border-radius: 99px;
        }
        .grades-scroll::-webkit-scrollbar-thumb:hover {
            background: ${isDark ? 'rgba(100,116,139,0.8)' : 'rgba(100,116,139,0.8)'};
        }
        .grades-scroll { scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(100,116,139,0.5) rgba(15,23,42,0.4)' : 'rgba(148,163,184,0.6) rgba(241,245,249,0.8)'}; }
    `;

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

    const currentGrades: (StudentGradeRow | TutorGradeRow)[] = useMemo(() => { if (selectionType === 'student') return studentGrades; if (selectionType === 'tutor') return tutorGrades; return []; }, [selectionType, studentGrades, tutorGrades]);
    const loadingCurrentGrades = selectionType === 'student' ? loadingStudentGrades : selectionType === 'tutor' ? loadingTutorGrades : false;

    const subjectOptions = useMemo(() => { const map = new Map<string, string>(); for (const g of currentGrades) { if (g.subject_id && g.subject_name && !map.has(g.subject_id)) map.set(g.subject_id, g.subject_name); } return Array.from(map.entries()).map(([id, name]) => ({ id, name })); }, [currentGrades]);

    useEffect(() => { if (activeTab !== 'by-subject' || selectedSubjectId || !subjectOptions.length) return; setSelectedSubjectId(subjectOptions[0].id); }, [activeTab, subjectOptions, selectedSubjectId]);

    const visibleGrades = useMemo(() => { if (activeTab === 'overall') return currentGrades; if (!selectedSubjectId) return []; return currentGrades.filter((g) => g.subject_id === selectedSubjectId); }, [currentGrades, activeTab, selectedSubjectId]);

    const gradesForChart = useMemo(() => visibleGrades.map((g) => ({ test_date: g.test_date, grade: g.grade, test_name: g.test_name })), [visibleGrades]);

    const { avgGrade, gradedCount } = useMemo(() => { const valid = visibleGrades.filter((g) => typeof g.grade === 'number'); if (!valid.length) return { avgGrade: null as number | null, gradedCount: 0 }; const sum = valid.reduce((acc, g) => acc + (g.grade ?? 0), 0); return { avgGrade: sum / valid.length, gradedCount: valid.length }; }, [visibleGrades]);

    const formatDate = (value: string | null) => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
    const formatTime = (value: string | null) => value ? value.slice(0, 5) : '';
    const hasSelection = selectionType === 'student' ? !!selectedStudent : selectionType === 'tutor' ? !!selectedTutor : false;
    const headerSubtitle = selectionType === 'student' && selectedStudent ? selectedStudent.full_name : selectionType === 'tutor' && selectedTutor ? selectedTutor.full_name : 'Επίλεξε μαθητή ή καθηγητή από αριστερά.';
    const avgBoxTitle = selectionType === 'tutor' ? (activeTab === 'overall' ? 'Μέσος όρος επίδοσης (όλα τα μαθήματα)' : 'Μέσος όρος επίδοσης στο επιλεγμένο μάθημα') : (activeTab === 'overall' ? 'Μέσος όρος βαθμών (όλα τα μαθήματα)' : 'Μέσος όρος στο επιλεγμένο μάθημα');

    const ListCard = ({ title, icon, search, onSearch, loading: listLoading, items, onSelect, selectedId }: {
        title: string; icon: React.ReactNode; search: string; onSearch: (v: string) => void;
        loading: boolean; items: { id: string; full_name: string }[]; onSelect: (item: any) => void; selectedId?: string | null;
    }) => (
        <div className={cardCls}>
            <div className={cardHeaderCls}>
                <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</span>
                <span className={countBadgeCls}>{items.length}</span>
            </div>
            <div className="p-3">
                <div className="relative mb-2">
                    <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                        className={listSearchCls}
                        placeholder={`Αναζήτηση ${title.toLowerCase()}...`}
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>
                <div className={`max-h-[220px] overflow-y-auto grades-scroll ${listBorderCls}`}>
                    {listLoading ? (
                        <div className={listDivideCls}>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                                    <div className={`h-2.5 w-2/3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                                </div>
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <div className={`flex items-center justify-center py-6 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Δεν βρέθηκαν αποτελέσματα.
                        </div>
                    ) : (
                        <div className={listDivideCls}>
                            {items.map((item) => {
                                const isSelected = item.id === selectedId;
                                return (
                                    <button key={item.id} type="button" onClick={() => onSelect(item)}
                                        className={`group flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
                                            isSelected
                                                ? isDark ? 'bg-white/[0.07]' : 'bg-slate-100'
                                                : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                                        }`}>
                                        <span className={`text-xs font-medium transition-colors ${
                                            isSelected
                                                ? isDark ? 'text-slate-50' : 'text-slate-900'
                                                : isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-800'
                                        }`}>{item.full_name}</span>
                                        <ChevronRight className={`h-3.5 w-3.5 transition-colors ${
                                            isSelected
                                                ? 'text-[color:var(--color-accent)]'
                                                : isDark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-300 group-hover:text-slate-500'
                                        }`} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 px-1">
            {/* Inject scrollbar styles */}
            <style>{scrollbarStyle}</style>

            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
                    <BarChart3 className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }}/>
                </div>
                <div>
                    <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Βαθμοί</h1>
                    <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δες την πορεία βαθμών για μαθητές και καθηγητές.</p>
                </div>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row">
                {/* LEFT: Students + Tutors */}
                <div className="w-full lg:w-[280px] xl:w-[300px] flex flex-col gap-4 shrink-0">
                    <ListCard title="Μαθητές" icon={<Users className="h-4 w-4" />} search={studentSearch} onSearch={setStudentSearch} loading={loadingStudents} items={filteredStudents} onSelect={handleSelectStudent} selectedId={selectedStudent?.id} />
                    <ListCard title="Καθηγητές" icon={<GraduationCap className="h-4 w-4" />} search={tutorSearch} onSearch={setTutorSearch} loading={loadingTutors} items={filteredTutors} onSelect={handleSelectTutor} selectedId={selectedTutor?.id} />
                </div>

                {/* RIGHT: Grades panel */}
                <div className="w-full flex-1 min-w-0">
                    <div className={panelCardCls}>
                        {/* Panel header */}
                        <div className={panelHeaderCls}>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
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
                                                <button key={tab} type="button" onClick={() => { setActiveTab(tab); if (tab === 'overall') setSelectedSubjectId(null); }}
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
                                            ? <select value={selectedSubjectId ?? subjectOptions[0]?.id ?? ''} onChange={(e) => setSelectedSubjectId(e.target.value || null)} className={subjectSelectCls}>
                                                {subjectOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                              </select>
                                            : <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα με βαθμούς.</span>
                                    )}
                                </div>

                                {/* Chart */}
                                <StudentGradesChart grades={gradesForChart} loading={loadingCurrentGrades} />

                                {/* Average box */}
                                {!loadingCurrentGrades && visibleGrades.length > 0 && (
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
                                {loadingCurrentGrades ? (
                                    <div className={skeletonDivideCls}>
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="flex gap-4 px-5 py-3.5 animate-pulse">
                                                <div className={`h-3 w-1/5 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                                                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200/70'}`} />
                                                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
                                            </div>
                                        ))}
                                    </div>
                                ) : visibleGrades.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δεν υπάρχουν βαθμοί</p>
                                        <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>για τα επιλεγμένα κριτήρια.</p>
                                    </div>
                                ) : (
                                    <div className={gradesTableWrapCls}>
                                        <div className="max-h-[400px] overflow-y-auto grades-scroll">
                                            <table className="min-w-full border-collapse text-xs">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className={theadRowCls}>
                                                        {['Ημερομηνία', 'Ώρα', 'Διαγώνισμα', 'Μάθημα', 'Τμήμα', 'Βαθμός'].map((h) => (
                                                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className={tbodyDivideCls}>
                                                    {visibleGrades.map((g) => (
                                                        <tr key={g.id} className={trHoverCls}>
                                                            <td className={`px-4 py-2.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(g.test_date)}</td>
                                                            <td className={`px-4 py-2.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatTime(g.start_time)}{g.end_time ? ` – ${formatTime(g.end_time)}` : ''}</td>
                                                            <td className={`px-4 py-2.5 font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{g.test_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                                                            <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g.subject_name ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                                                            <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g.class_title ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                                                            <td className="px-4 py-2.5">
                                                                {g.grade !== null
                                                                    ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>{g.grade}</span>
                                                                    : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GradesPage;