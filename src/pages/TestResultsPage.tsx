import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowLeft, ArrowRight, BookOpen, Calendar, Check, ClipboardList,
  Clock, Loader2, Search, Tag, Users,
} from 'lucide-react';
import type { GradeInfo, StudentRow, TestResultRow } from '../components/tests/types';

type TestDetail = {
  id: string;
  class_id: string | null;
  level_id: string | null;
  subject_id: string | null;
  test_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  classTitle: string;
  subjectName: string;
  dateDisplay: string;
  timeRange: string;
};

export default function TestResultsPage() {
  const { id: testId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [loadingTest, setLoadingTest] = useState(true);
  const [test, setTest] = useState<TestDetail | null>(null);
  const [subjectNameById, setSubjectNameById] = useState<Map<string, string>>(new Map());

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [classStudentIds, setClassStudentIds] = useState<Set<string> | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [gradeByStudent, setGradeByStudent] = useState<Record<string, GradeInfo>>({});
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set());
  const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set());

  // A test created via the idiaitera per-student flow has no class/level — subject lives per assignment instead.
  const isPrivateTest = !!test && !test.class_id && !test.level_id;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load test details
  useEffect(() => {
    if (!testId || !schoolId) return;
    const load = async () => {
      setLoadingTest(true);
      try {
        const [
          { data: testData, error: testErr },
          { data: classesData },
          { data: levelsData },
          { data: subjectsData },
        ] = await Promise.all([
          supabase.from('tests').select('id, class_id, level_id, subject_id, test_date, start_time, end_time, title').eq('id', testId).eq('school_id', schoolId).single(),
          supabase.from('classes').select('id, title').eq('school_id', schoolId),
          supabase.from('levels').select('id, name').eq('school_id', schoolId),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
        ]);
        if (testErr || !testData) { setLoadingTest(false); return; }
        const classById = new Map<string, string>((classesData ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
        const levelById = new Map<string, string>((levelsData ?? []).map((l: { id: string; name: string }) => [l.id, l.name]));
        const subjById = new Map<string, string>((subjectsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
        setSubjectNameById(subjById);
        const t = testData as { id: string; class_id: string | null; level_id: string | null; subject_id: string | null; test_date: string; start_time: string | null; end_time: string | null; title: string | null };
        setTest({
          id: t.id,
          class_id: t.class_id,
          level_id: t.level_id,
          subject_id: t.subject_id,
          test_date: t.test_date,
          start_time: t.start_time,
          end_time: t.end_time,
          title: t.title,
          classTitle: (t.class_id ? classById.get(t.class_id) : null) ?? (t.level_id ? levelById.get(t.level_id) : null) ?? '—',
          subjectName: (t.subject_id ? subjById.get(t.subject_id) : null) ?? '—',
          dateDisplay: new Date(t.test_date).toLocaleDateString('el-GR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          timeRange: t.start_time && t.end_time ? `${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)}` : '',
        });
      } catch (err) { console.error(err); }
      finally { setLoadingTest(false); }
    };
    load();
  }, [testId, schoolId]);

  // Load students + existing results
  useEffect(() => {
    if (!testId || !schoolId || loadingTest) return;
    const load = async () => {
      setLoadingStudents(true);
      try {
        const [
          { data: studentsData, error: studentsErr },
          { data: resultsData, error: resultsErr },
          classStudentsRes,
        ] = await Promise.all([
          supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }),
          supabase.from('test_results').select('id, test_id, student_id, subject_id, grade').eq('test_id', testId),
          test?.class_id
            ? supabase.from('class_students').select('student_id').eq('school_id', schoolId).eq('class_id', test.class_id)
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (studentsErr) throw studentsErr;
        if (resultsErr) throw resultsErr;
        const studentsList = (studentsData ?? []) as StudentRow[];
        setAllStudents(studentsList);
        setClassStudentIds(
          test?.class_id && !classStudentsRes.error
            ? new Set((classStudentsRes.data ?? []).map((r: { student_id: string }) => r.student_id))
            : null,
        );
        const newAssigned = new Set<string>();
        const gradeMap: Record<string, GradeInfo> = {};
        (resultsData ?? []).forEach((raw) => {
          const r = raw as TestResultRow;
          newAssigned.add(r.student_id);
          gradeMap[r.student_id] = { grade: r.grade !== null ? String(r.grade) : '', existingResultId: r.id, subjectId: r.subject_id ?? null };
        });
        studentsList.forEach((s) => { if (!gradeMap[s.id]) gradeMap[s.id] = { grade: '', existingResultId: undefined }; });
        setAssignedIds(newAssigned);
        setInitialAssignedIds(new Set(newAssigned));
        setGradeByStudent(gradeMap);
      } catch (err) { console.error(err); }
      finally { setLoadingStudents(false); }
    };
    load();
  }, [testId, schoolId, loadingTest, test?.class_id]);

  const handleSave = async () => {
    setError(null);
    for (const studentId of assignedIds) {
      const info = gradeByStudent[studentId];
      const gradeTrim = (info?.grade ?? '').trim();
      if (!gradeTrim) {
        const st = allStudents.find((s) => s.id === studentId);
        setError(`Συμπληρώστε βαθμό για τον μαθητή "${st?.full_name ?? 'Άγνωστος'}".`);
        return;
      }
      if (Number.isNaN(Number(gradeTrim.replace(',', '.')))) {
        const st = allStudents.find((s) => s.id === studentId);
        setError(`Μη έγκυρος βαθμός για "${st?.full_name ?? 'Άγνωστος'}".`);
        return;
      }
    }
    setSaving(true);
    try {
      const inserts: { test_id: string; student_id: string; grade: number }[] = [];
      const updates: { id: string; grade: number }[] = [];
      const deleteIds: string[] = [];
      for (const studentId of assignedIds) {
        const info = gradeByStudent[studentId];
        const gradeNum = Number((info?.grade ?? '').trim().replace(',', '.'));
        if (initialAssignedIds.has(studentId)) {
          if (info?.existingResultId) updates.push({ id: info.existingResultId, grade: gradeNum });
        } else {
          inserts.push({ test_id: testId!, student_id: studentId, grade: gradeNum });
        }
      }
      for (const studentId of initialAssignedIds) {
        if (!assignedIds.has(studentId)) {
          const info = gradeByStudent[studentId];
          if (info?.existingResultId) deleteIds.push(info.existingResultId);
        }
      }
      if (inserts.length > 0) { const { error: e } = await supabase.from('test_results').insert(inserts); if (e) throw e; }
      for (const upd of updates) { const { error: e } = await supabase.from('test_results').update({ grade: upd.grade }).eq('id', upd.id); if (e) throw e; }
      if (deleteIds.length > 0) { const { error: e } = await supabase.from('test_results').delete().in('id', deleteIds); if (e) throw e; }
      setInitialAssignedIds(new Set(assignedIds));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error(err); setError('Αποτυχία αποθήκευσης βαθμών.'); }
    finally { setSaving(false); }
  };

  const scopedToClass = !showAllStudents && classStudentIds !== null;
  const availableStudents = useMemo(() =>
    allStudents.filter((s) =>
      !assignedIds.has(s.id) &&
      (!scopedToClass || classStudentIds!.has(s.id)) &&
      (s.full_name ?? '').toLowerCase().includes(searchLeft.toLowerCase())),
    [allStudents, assignedIds, searchLeft, scopedToClass, classStudentIds]);

  const assignedStudents = useMemo(() =>
    allStudents.filter((s) => assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchRight.toLowerCase())),
    [allStudents, assignedIds, searchRight]);

  const allAssignedStudents = useMemo(() =>
    allStudents.filter((s) => assignedIds.has(s.id)),
    [allStudents, assignedIds]);

  // Selection helpers
  const visibleLeftSelected = availableStudents.filter(s => selectedLeft.has(s.id));
  const visibleRightSelected = assignedStudents.filter(s => selectedRight.has(s.id));
  const allLeftChecked = availableStudents.length > 0 && availableStudents.every(s => selectedLeft.has(s.id));
  const someLeftChecked = availableStudents.some(s => selectedLeft.has(s.id)) && !allLeftChecked;
  const allRightChecked = assignedStudents.length > 0 && assignedStudents.every(s => selectedRight.has(s.id));
  const someRightChecked = assignedStudents.some(s => selectedRight.has(s.id)) && !allRightChecked;

  const toggleLeft = (id: string) => setSelectedLeft(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleRight = (id: string) => setSelectedRight(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllLeft = () => {
    if (allLeftChecked) setSelectedLeft(new Set());
    else setSelectedLeft(new Set(availableStudents.map(s => s.id)));
  };
  const toggleAllRight = () => {
    if (allRightChecked) setSelectedRight(new Set());
    else setSelectedRight(new Set(assignedStudents.map(s => s.id)));
  };
  const moveToAssigned = () => {
    if (saving || visibleLeftSelected.length === 0) return;
    setAssignedIds(prev => { const n = new Set(prev); visibleLeftSelected.forEach(s => n.add(s.id)); return n; });
    setSelectedLeft(new Set());
  };
  const moveToAvailable = () => {
    if (saving || visibleRightSelected.length === 0) return;
    setAssignedIds(prev => { const n = new Set(prev); visibleRightSelected.forEach(s => n.delete(s.id)); return n; });
    setSelectedRight(new Set());
  };

  // ── Style helpers — flat, no cards: accent-underline headers + hairline dividers ──
  const colHeaderCls = 'px-1 pb-3 pt-1';
  const colHeaderStyle: React.CSSProperties = { borderBottom: '2px solid var(--color-accent)' };
  const colHeaderLabelCls = `text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`;

  const sectionTitleRowCls = 'flex items-center gap-2.5';
  const sectionIconCls = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg';
  const sectionIconStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    color: 'var(--color-accent)',
  };
  const sectionTitleCls = `text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`;
  const sectionSubtitleCls = `mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const sectionDividerCls = `h-px w-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200'}`;
  const colDivideCls = isDark ? 'divide-slate-800' : 'divide-slate-200';

  const checkboxStyle: React.CSSProperties = { accentColor: 'var(--color-accent)', cursor: 'pointer' };
  const rowCls = `flex items-center gap-2.5 px-1 py-2.5 transition cursor-pointer select-none ${isDark ? 'hover:bg-blue-500/[0.12]' : 'hover:bg-blue-50'}`;
  const rowHoverCls = isDark ? 'hover:bg-blue-500/[0.12]' : 'hover:bg-blue-50';

  const searchBoxCls = `flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
    isDark ? 'border-slate-700/60 bg-slate-900/60' : 'border-slate-200 bg-white'
  }`;

  const searchInputCls = `w-28 bg-transparent text-[11px] outline-none ${
    isDark ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'
  }`;

  const gradeInputCls = `h-8 w-20 shrink-0 rounded-lg border px-2 text-xs outline-none transition ${
    isDark
      ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]'
      : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
  }`;

  const dividerCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;

  if (loadingTest) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`h-5 w-5 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Το διαγώνισμα δεν βρέθηκε.</p>
        <button type="button" onClick={() => navigate('/program/tests')}
          className={`text-xs underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Επιστροφή στα διαγωνίσματα
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1">
      {/* Back button + page title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/program/tests')}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-accent)' }}>
            <Users className="h-4 w-4" style={{ color: 'var(--color-on-accent)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Βαθμοί διαγωνίσματος
            </h1>
          </div>
        </div>
      </div>

      {/* Test info */}
      <div className="space-y-5">
        <div className={sectionTitleRowCls}>
          <div className={sectionIconCls} style={sectionIconStyle}>
            <ClipboardList className="h-4 w-4" />
          </div>
          <h2 className={sectionTitleCls}>
            {test.title || (isPrivateTest ? 'Διαγώνισμα' : `${test.subjectName} — ${test.classTitle}`)}
          </h2>
        </div>
        <div className={`grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:divide-x ${colDivideCls}`}>
          {(isPrivateTest ? [
            { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Ημερομηνία', value: test.dateDisplay },
            { icon: <Clock className="h-3.5 w-3.5" />, label: 'Ώρα', value: test.timeRange || '—' },
            { icon: <Users className="h-3.5 w-3.5" />, label: 'Μαθητές', value: loadingStudents ? 'Φόρτωση...' : (allAssignedStudents.map((s) => s.full_name).join(', ') || '—') },
          ] : [
            { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Ημερομηνία', value: test.dateDisplay },
            { icon: <Clock className="h-3.5 w-3.5" />, label: 'Ώρα', value: test.timeRange || '—' },
            { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Τμήμα', value: test.classTitle },
            { icon: <Tag className="h-3.5 w-3.5" />, label: 'Μάθημα', value: test.subjectName },
          ]).map(({ icon, label, value }, i) => (
            <div key={label} className={`flex flex-col gap-1.5 ${i > 0 ? 'sm:pl-6' : ''}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <span style={{ color: 'var(--color-accent)', opacity: 0.8 }}>{icon}</span>
                {label}
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={sectionDividerCls} />

      {/* Grade entry section */}
      <div className="space-y-5">
        <div className={sectionTitleRowCls}>
          <div className={sectionIconCls} style={sectionIconStyle}>
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className={sectionTitleCls}>Καταχώρηση βαθμών</h2>
            <p className={sectionSubtitleCls}>
              {isPrivateTest ? 'Συμπλήρωσε τον βαθμό για κάθε μαθητή του διαγωνίσματος.' : 'Μετακίνησε μαθητές στα δεξιά και συμπλήρωσε τους βαθμούς τους.'}
            </p>
          </div>
        </div>

        {loadingStudents ? (
          <div className={`flex items-center justify-center gap-2 py-16 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Loader2 className="h-4 w-4 animate-spin" />Φόρτωση μαθητών...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{error}
              </div>
            )}

            {isPrivateTest ? (
              <div className="flex flex-col">
                <div className={colHeaderCls} style={colHeaderStyle}>
                  <div className="flex items-center gap-2">
                    <span className={colHeaderLabelCls}>Μαθητές διαγωνίσματος</span>
                    {allAssignedStudents.length > 0 && (
                      <span className="rounded-full px-1.5 py-px text-[10px] tabular-nums"
                        style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                        {allAssignedStudents.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className={dividerCls}>
                  {allAssignedStudents.length === 0
                    ? <p className={`px-1 py-5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν ανατεθεί μαθητές σε αυτό το διαγώνισμα. Επεξεργαστείτε το από τη σελίδα «Διαγωνίσματα».</p>
                    : allAssignedStudents.map((s) => {
                      const info = gradeByStudent[s.id] ?? { grade: '' };
                      const subjectName = info.subjectId ? subjectNameById.get(info.subjectId) : null;
                      return (
                        <div key={s.id} className={`flex items-center gap-3 px-1 py-2.5 transition-colors ${rowHoverCls}`}>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</p>
                            {subjectName && <p className={`truncate text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subjectName}</p>}
                          </div>
                          <input type="text" inputMode="decimal" placeholder="π.χ. 18"
                            value={info.grade}
                            onChange={(e) => setGradeByStudent((prev) => ({
                              ...prev,
                              [s.id]: { grade: e.target.value, existingResultId: prev[s.id]?.existingResultId, subjectId: prev[s.id]?.subjectId },
                            }))}
                            className={gradeInputCls}
                            disabled={saving}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
            <div className={`grid gap-6 lg:grid-cols-2 lg:gap-x-0 lg:divide-x ${colDivideCls}`}>
              {/* Left: all students */}
              <div className="flex flex-col lg:pr-6">
                <div className={colHeaderCls} style={colHeaderStyle}>
                  <div className="flex items-center justify-between">
                    <span className={colHeaderLabelCls}>
                      {scopedToClass ? 'Μαθητές τμήματος' : 'Όλοι οι μαθητές'}
                      {availableStudents.length > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>
                          {availableStudents.length}
                        </span>
                      )}
                    </span>
                    <div className={searchBoxCls}>
                      <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchLeft} onChange={(e) => setSearchLeft(e.target.value)} disabled={saving} />
                    </div>
                  </div>
                  {classStudentIds !== null && (
                    <label className={`mt-2 flex w-fit items-center gap-1.5 text-[11px] cursor-pointer ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded"
                        style={checkboxStyle}
                        checked={showAllStudents}
                        onChange={() => setShowAllStudents((v) => !v)}
                        disabled={saving}
                      />
                      Εμφάνιση όλων των μαθητών
                    </label>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded"
                        style={checkboxStyle}
                        checked={allLeftChecked}
                        ref={el => { if (el) el.indeterminate = someLeftChecked; }}
                        onChange={toggleAllLeft}
                        disabled={saving || availableStudents.length === 0}
                      />
                      Επιλογή όλων
                    </label>
                    <button type="button" onClick={moveToAssigned}
                      disabled={saving || visibleLeftSelected.length === 0}
                      className="flex items-center gap-1 px-1 py-1 text-[11px] font-semibold transition disabled:opacity-30 active:scale-95"
                      style={{ color: 'var(--color-accent)' }}>
                      {visibleLeftSelected.length > 0 ? `Προσθήκη (${visibleLeftSelected.length})` : 'Προσθήκη'}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className={`flex-1 overflow-y-auto ${dividerCls}`} style={{ maxHeight: 320 }}>
                  {availableStudents.length === 0
                    ? <p className={`px-1 py-5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
                    : availableStudents.map((s) => (
                      <div key={s.id} className={rowCls} onClick={() => !saving && toggleLeft(s.id)}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 shrink-0 rounded"
                          style={checkboxStyle}
                          checked={selectedLeft.has(s.id)}
                          onChange={() => toggleLeft(s.id)}
                          onClick={e => e.stopPropagation()}
                          disabled={saving}
                        />
                        <span className={`truncate text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right: assigned with grades */}
              <div className="flex flex-col lg:pl-6">
                <div className={colHeaderCls} style={colHeaderStyle}>
                  <div className="flex items-center justify-between">
                    <span className={colHeaderLabelCls}>
                      Έγραψαν
                      {assignedIds.size > 0 && (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums"
                          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                          {assignedIds.size}
                        </span>
                      )}
                    </span>
                    <div className={searchBoxCls}>
                      <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchRight} onChange={(e) => setSearchRight(e.target.value)} disabled={saving} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button type="button" onClick={moveToAvailable}
                      disabled={saving || visibleRightSelected.length === 0}
                      className="flex items-center gap-1 px-1 py-1 text-[11px] font-semibold transition disabled:opacity-30 active:scale-95"
                      style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                      <ArrowLeft className="h-3 w-3" />
                      {visibleRightSelected.length > 0 ? `Αφαίρεση (${visibleRightSelected.length})` : 'Αφαίρεση'}
                    </button>
                    <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded"
                        style={checkboxStyle}
                        checked={allRightChecked}
                        ref={el => { if (el) el.indeterminate = someRightChecked; }}
                        onChange={toggleAllRight}
                        disabled={saving || assignedStudents.length === 0}
                      />
                      Επιλογή όλων
                    </label>
                  </div>
                </div>
                <div className={`flex-1 overflow-y-auto ${dividerCls}`} style={{ maxHeight: 320 }}>
                  {assignedStudents.length === 0
                    ? <p className={`px-1 py-5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές ακόμα.</p>
                    : assignedStudents.map((s) => {
                      const info = gradeByStudent[s.id] ?? { grade: '' };
                      return (
                        <div key={s.id} className={`flex items-center gap-2 px-1 py-2.5 transition-colors ${rowHoverCls}`}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 rounded"
                            style={checkboxStyle}
                            checked={selectedRight.has(s.id)}
                            onChange={() => toggleRight(s.id)}
                            disabled={saving}
                          />
                          <span className={`flex-1 truncate text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
                          <input type="text" inputMode="decimal" placeholder="π.χ. 18"
                            value={info.grade}
                            onChange={(e) => setGradeByStudent((prev) => ({
                              ...prev,
                              [s.id]: { grade: e.target.value, existingResultId: prev[s.id]?.existingResultId },
                            }))}
                            className={gradeInputCls}
                            disabled={saving}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            )}

            {/* Save bar */}
            <div className={`flex items-center justify-between border-t pt-4 ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {assignedIds.size} μαθητές επιλέχθηκαν
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || assignedIds.size === 0}
                className="btn-primary inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>
                  : saved
                    ? <><Check className="h-3 w-3" />Αποθηκεύτηκε!</>
                    : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
