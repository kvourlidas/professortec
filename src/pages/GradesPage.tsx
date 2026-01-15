// src/pages/GradesPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { BarChart3, Search } from 'lucide-react';
import StudentGradesChart from '../components/grades/StudentGradesChart';

type StudentRow = {
    id: string;
    school_id: string;
    full_name: string;
    email: string | null;
};

type TutorRow = {
    id: string;
    school_id: string;
    full_name: string;
    email: string | null;
};

type StudentGradeRow = {
    id: string;
    student_id: string;
    test_id: string;
    test_name: string | null;
    test_date: string | null;
    start_time: string | null;
    end_time: string | null;
    class_title: string | null;
    subject_id: string | null;
    subject_name: string | null;
    grade: number | null;
    graded_at: string | null;
};

type TutorGradeRow = {
    id: string;
    school_id: string;
    tutor_id: string;
    tutor_name: string | null;
    test_id: string;
    test_name: string | null;
    test_date: string | null;
    start_time: string | null;
    end_time: string | null;
    class_title: string | null;
    subject_id: string | null;
    subject_name: string | null;
    grade: number | null;          // 👈 average grade for that test
    students_count: number | null; // πόσοι μαθητές
};

type GradesTab = 'overall' | 'by-subject';
type SelectionType = 'student' | 'tutor' | null;

const GradesPage = () => {
    const { profile } = useAuth();

    // ---------- Left: students ----------
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');

    // ---------- Left: tutors ----------
    const [tutors, setTutors] = useState<TutorRow[]>([]);
    const [loadingTutors, setLoadingTutors] = useState(false);
    const [tutorSearch, setTutorSearch] = useState('');

    // ---------- Right: selection ----------
    const [selectionType, setSelectionType] = useState<SelectionType>(null);
    const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
    const [selectedTutor, setSelectedTutor] = useState<TutorRow | null>(null);

    // ---------- Right: student grades ----------
    const [studentGrades, setStudentGrades] = useState<StudentGradeRow[]>([]);
    const [loadingStudentGrades, setLoadingStudentGrades] = useState(false);

    // ---------- Right: tutor grades ----------
    const [tutorGrades, setTutorGrades] = useState<TutorGradeRow[]>([]);
    const [loadingTutorGrades, setLoadingTutorGrades] = useState(false);

    // ---------- Right: tabs & subject filter ----------
    const [activeTab, setActiveTab] = useState<GradesTab>('overall');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

    /* ---------------- Load students & tutors ---------------- */

    useEffect(() => {
        if (!profile?.school_id) return;

        const loadStudents = async () => {
            setLoadingStudents(true);

            const { data, error } = await supabase
                .from('students')
                .select('id, school_id, full_name, email')
                .eq('school_id', profile.school_id)
                .order('full_name', { ascending: true });

            if (error) {
                console.error('Error loading students for GradesPage:', error);
            } else {
                setStudents(data ?? []);
            }

            setLoadingStudents(false);
        };

        const loadTutors = async () => {
            setLoadingTutors(true);

            const { data, error } = await supabase
                .from('tutors')
                .select('id, school_id, full_name, email')
                .eq('school_id', profile.school_id)
                .order('full_name', { ascending: true });

            if (error) {
                console.error('Error loading tutors for GradesPage:', error);
            } else {
                setTutors(data ?? []);
            }

            setLoadingTutors(false);
        };

        loadStudents();
        loadTutors();
    }, [profile?.school_id]);

    /* ---------------- Filters for lists ---------------- */

    const filteredStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) => s.full_name.toLowerCase().includes(q));
    }, [students, studentSearch]);

    const filteredTutors = useMemo(() => {
        const q = tutorSearch.trim().toLowerCase();
        if (!q) return tutors;
        return tutors.filter((t) => t.full_name.toLowerCase().includes(q));
    }, [tutors, tutorSearch]);

    /* ---------------- Select student / tutor ---------------- */

    const handleSelectStudent = async (student: StudentRow) => {
        if (!profile?.school_id) return;

        setSelectionType('student');
        setSelectedStudent(student);
        setSelectedTutor(null);
        setActiveTab('overall');
        setSelectedSubjectId(null);

        setLoadingStudentGrades(true);
        setStudentGrades([]);

        const { data, error } = await supabase
            .from('student_test_grades')
            .select(
                'id, student_id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, graded_at'
            )
            .eq('school_id', profile.school_id)
            .eq('student_id', student.id)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('Error loading grades for student:', error);
            setStudentGrades([]);
        } else {
            setStudentGrades((data ?? []) as StudentGradeRow[]);
        }

        setLoadingStudentGrades(false);
    };

    const handleSelectTutor = async (tutor: TutorRow) => {
        if (!profile?.school_id) return;

        setSelectionType('tutor');
        setSelectedTutor(tutor);
        setSelectedStudent(null);
        setActiveTab('overall');
        setSelectedSubjectId(null);

        setLoadingTutorGrades(true);
        setTutorGrades([]);

        const { data, error } = await supabase
            .from('tutor_test_grades')
            .select(
                'id, school_id, tutor_id, tutor_name, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, students_count'
            )
            .eq('school_id', profile.school_id)
            .eq('tutor_id', tutor.id)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('Error loading grades for tutor:', error);
            setTutorGrades([]);
        } else {
            setTutorGrades((data ?? []) as TutorGradeRow[]);
        }

        setLoadingTutorGrades(false);
    };

    /* ---------------- Current grades (student OR tutor) ---------------- */

    const currentGrades: (StudentGradeRow | TutorGradeRow)[] = useMemo(() => {
        if (selectionType === 'student') return studentGrades;
        if (selectionType === 'tutor') return tutorGrades;
        return [];
    }, [selectionType, studentGrades, tutorGrades]);

    const loadingCurrentGrades =
        selectionType === 'student'
            ? loadingStudentGrades
            : selectionType === 'tutor'
                ? loadingTutorGrades
                : false;

    /* ---------------- Subject options for current selection ---------------- */

    const subjectOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const g of currentGrades) {
            if (g.subject_id && g.subject_name && !map.has(g.subject_id)) {
                map.set(g.subject_id, g.subject_name);
            }
        }
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [currentGrades]);

    // Αν πάω σε "Ανά μάθημα" και δεν έχω subject επιλεγμένο, πάρε το πρώτο διαθέσιμο
    useEffect(() => {
        if (activeTab !== 'by-subject') return;
        if (selectedSubjectId) return;
        if (subjectOptions.length === 0) return;
        setSelectedSubjectId(subjectOptions[0].id);
    }, [activeTab, subjectOptions, selectedSubjectId]);

    /* ---------------- Visible grades based on tab / subject ---------------- */

    const visibleGrades: (StudentGradeRow | TutorGradeRow)[] = useMemo(() => {
        if (activeTab === 'overall') return currentGrades;
        if (!selectedSubjectId) return [];
        return currentGrades.filter((g) => g.subject_id === selectedSubjectId);
    }, [currentGrades, activeTab, selectedSubjectId]);

    // Δεδομένα για το chart (μόνο date + grade + test_name)
    const gradesForChart = useMemo(
        () =>
            visibleGrades.map((g) => ({
                test_date: g.test_date,
                grade: g.grade,
                test_name: g.test_name,
            })),
        [visibleGrades]
    );

    /* ---------------- Average grade for visible grades ---------------- */

    const { avgGrade, gradedCount } = useMemo(() => {
        const valid = visibleGrades.filter((g) => typeof g.grade === 'number');
        if (!valid.length) {
            return { avgGrade: null as number | null, gradedCount: 0 };
        }
        const sum = valid.reduce((acc, g) => acc + (g.grade ?? 0), 0);
        return { avgGrade: sum / valid.length, gradedCount: valid.length };
    }, [visibleGrades]);

    /* ---------------- Helpers ---------------- */

    const formatDate = (value: string | null) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('el-GR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatTime = (value: string | null) => {
        if (!value) return '';
        return value.slice(0, 5); // HH:MM από HH:MM:SS
    };

    const hasSelection =
        selectionType === 'student'
            ? !!selectedStudent
            : selectionType === 'tutor'
                ? !!selectedTutor
                : false;

    const headerTitle =
        selectionType === 'student'
            ? 'Βαθμοί μαθητή'
            : selectionType === 'tutor'
                ? 'Βαθμοί καθηγητή'
                : 'Βαθμοί';

    const headerSubtitle =
        selectionType === 'student' && selectedStudent
            ? selectedStudent.full_name
            : selectionType === 'tutor' && selectedTutor
                ? selectedTutor.full_name
                : 'Επίλεξε μαθητή ή καθηγητή από αριστερά.';

    const avgBoxTitle =
        selectionType === 'tutor'
            ? activeTab === 'overall'
                ? 'Μέσος όρος επίδοσης (όλα τα μαθήματα)'
                : 'Μέσος όρος επίδοσης στο επιλεγμένο μάθημα'
            : activeTab === 'overall'
                ? 'Μέσος όρος βαθμών (όλα τα μαθήματα)'
                : 'Μέσος όρος στο επιλεγμένο μάθημα';

    /* ---------------- Render ---------------- */

    return (
        <div className="h-full w-full px-6 py-5">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                        <BarChart3 className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                        Βαθμοί
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Δες την πορεία βαθμών για μαθητές και καθηγητές.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row">
                {/* LEFT COLUMN: Students + Tutors */}
                <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col gap-4">
                    {/* Students card */}
                    <div className="rounded-2xl border border-slate-300/25 bg-slate-900/30 p-4 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/5">
                        <div className="mb-4">
                            <label className="mb-1 block text-xs font-medium text-slate-400">
                                Αναζήτηση μαθητή
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-slate-300/20 bg-slate-950/30 px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-sky-500">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    placeholder="Πληκτρολόγησε όνομα μαθητή..."
                                    className="h-7 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-2 max-h-[260px] overflow-y-auto rounded-xl border border-slate-300/20 bg-slate-950/20 shadow-inner ring-1 ring-inset ring-white/5 custom-scrollbar">
                            {loadingStudents ? (
                                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                                    Φόρτωση μαθητών...
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                                    Δεν βρέθηκαν μαθητές.
                                </div>
                            ) : (
                                <table className="min-w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10 bg-[#223449] border-b border-white/10">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-slate-300">
                                                Μαθητής
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold text-slate-300">
                                                Βαθμοί
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredStudents.map((s) => (
                                            <tr key={s.id} className="border-t border-slate-300/10 hover:bg-slate-900/20 transition-colors">
                                                <td className="px-4 py-2 align-middle text-[11px] font-medium text-slate-100">
                                                    {s.full_name}
                                                </td>
                                                <td className="px-4 py-2 align-middle">
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectStudent(s)}
                                                            className="inline-flex items-center justify-center rounded-lg border border-sky-500/60 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-400 transition hover:bg-sky-500/20 hover:text-sky-100"
                                                            title="Προβολή βαθμών"
                                                        >
                                                            <BarChart3 className="mr-1 h-3 w-3" />
                                                            Προβολή
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Tutors card */}
                    <div className="rounded-2xl border border-slate-300/25 bg-slate-900/30 p-4 shadow-lg backdrop-blur-md ring-1 ring-inset ring-white/5 custom-scrollbar">
                        <div className="mb-4">
                            <label className="mb-1 block text-xs font-medium text-slate-400">
                                Αναζήτηση καθηγητή
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-slate-300/20 bg-slate-950/30 px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-sky-500">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={tutorSearch}
                                    onChange={(e) => setTutorSearch(e.target.value)}
                                    placeholder="Πληκτρολόγησε όνομα καθηγητή..."
                                    className="h-7 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-2 max-h-[260px] overflow-y-auto rounded-xl border border-slate-300/20 bg-slate-950/20 shadow-inner ring-1 ring-inset ring-white/5 custom-scrollbar">
                            {loadingTutors ? (
                                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                                    Φόρτωση καθηγητών...
                                </div>
                            ) : filteredTutors.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                                    Δεν βρέθηκαν καθηγητές.
                                </div>
                            ) : (
                                <table className="min-w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10 bg-[#223449] border-b border-white/10">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-slate-300">
                                                Καθηγητής
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold text-slate-300">
                                                Βαθμοί
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredTutors.map((t) => (
                                            <tr key={t.id} className="border-t border-slate-800/80">
                                                <td className="px-4 py-2 align-middle text-[11px] font-medium text-slate-100">
                                                    {t.full_name}
                                                </td>
                                                <td className="px-4 py-2 align-middle">
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectTutor(t)}
                                                            className="inline-flex items-center justify-center rounded-lg border border-sky-500/60 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-400 transition hover:bg-sky-500/20 hover:text-sky-100"
                                                            title="Προβολή επιδόσεων"
                                                        >
                                                            <BarChart3 className="mr-1 h-3 w-3" />
                                                            Προβολή
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: common panel for student OR tutor */}
                <div className="w-full flex-1">
                    <div className="h-full rounded-xl border border-slate-700 bg-slate-900/70 p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-sky-400" />
                            <div>
                                <h2 className="text-sm font-semibold text-slate-50">
                                    {headerTitle}
                                </h2>
                                <p className="mt-0.5 text-[11px] text-slate-400">{headerSubtitle}</p>
                            </div>
                        </div>

                        {!hasSelection ? (
                            <div className="flex h-[260px] items-center justify-center text-xs text-slate-500">
                                Επίλεξε μαθητή ή καθηγητή από τα αριστερά.
                            </div>
                        ) : (
                            <>
                                {/* Tabs + subject select */}
                                <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('overall');
                                                setSelectedSubjectId(null);
                                            }}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeTab === 'overall'
                                                ? 'border border-sky-500/70 bg-sky-500/15 text-sky-300'
                                                : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-800/80'
                                                }`}
                                        >
                                            Γενικά
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('by-subject')}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeTab === 'by-subject'
                                                ? 'border border-sky-500/70 bg-sky-500/15 text-sky-300'
                                                : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-800/80'
                                                }`}
                                        >
                                            Ανά μάθημα
                                        </button>
                                    </div>

                                    {activeTab === 'by-subject' && (
                                        subjectOptions.length > 0 ? (
                                            <select
                                                value={selectedSubjectId ?? subjectOptions[0]?.id ?? ''}
                                                onChange={(e) =>
                                                    setSelectedSubjectId(e.target.value || null)
                                                }
                                                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            >
                                                {subjectOptions.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>
                                                        {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-[11px] text-slate-500">
                                                Δεν υπάρχουν μαθήματα με βαθμούς.
                                            </span>
                                        )
                                    )}
                                </div>

                                {/* Chart */}
                                <StudentGradesChart
                                    grades={gradesForChart}
                                    loading={loadingCurrentGrades}
                                />

                                {/* Average box */}
                                {!loadingCurrentGrades && visibleGrades.length > 0 && (
                                    <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-200">
                                                {avgBoxTitle}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                Βασισμένος σε {gradedCount} διαγωνίσματα
                                            </p>
                                        </div>
                                        <div className="text-xl font-semibold text-sky-300">
                                            {avgGrade !== null ? avgGrade.toFixed(1) : '—'}
                                        </div>
                                    </div>
                                )}

                                {/* Table */}
                                {loadingCurrentGrades ? (
                                    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
                                        Φόρτωση δεδομένων...
                                    </div>
                                ) : visibleGrades.length === 0 ? (
                                    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
                                        Δεν υπάρχουν βαθμοί για τα επιλεγμένα κριτήρια.
                                    </div>
                                ) : (
                                    <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
                                        <table className="min-w-full text-left text-xs">
                                            <thead className="bg-slate-900/80">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Ημερομηνία
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Ώρα
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Διαγώνισμα
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Μάθημα
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Τμήμα
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold text-slate-300">
                                                        Βαθμός
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visibleGrades.map((g) => (
                                                    <tr
                                                        key={g.id}
                                                        className="border-t border-slate-800/80 hover:bg-slate-900/60"
                                                    >
                                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-100">
                                                            {formatDate(g.test_date)}
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-200">
                                                            {formatTime(g.start_time)}{' '}
                                                            {g.end_time ? `- ${formatTime(g.end_time)}` : ''}
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-100">
                                                            {g.test_name ?? <span className="text-slate-600">—</span>}
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-200">
                                                            {g.subject_name ?? (
                                                                <span className="text-slate-600">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-[11px] text-slate-200">
                                                            {g.class_title ?? (
                                                                <span className="text-slate-600">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 align-middle text-[11px] font-semibold text-sky-300">
                                                            {g.grade ?? <span className="text-slate-600">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GradesPage;
