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
  class_id: string;
  subject_id: string;
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

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [gradeByStudent, setGradeByStudent] = useState<Record<string, GradeInfo>>({});
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');

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
          { data: subjectsData },
        ] = await Promise.all([
          supabase.from('tests').select('id, class_id, subject_id, test_date, start_time, end_time, title').eq('id', testId).eq('school_id', schoolId).single(),
          supabase.from('classes').select('id, title').eq('school_id', schoolId),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
        ]);
        if (testErr || !testData) { setLoadingTest(false); return; }
        const classById = new Map<string, string>((classesData ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
        const subjById = new Map<string, string>((subjectsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
        const t = testData as { id: string; class_id: string; subject_id: string; test_date: string; start_time: string | null; end_time: string | null; title: string | null };
        setTest({
          id: t.id,
          class_id: t.class_id,
          subject_id: t.subject_id,
          test_date: t.test_date,
          start_time: t.start_time,
          end_time: t.end_time,
          title: t.title,
          classTitle: classById.get(t.class_id) ?? '—',
          subjectName: subjById.get(t.subject_id) ?? '—',
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
    if (!testId || !schoolId) return;
    const load = async () => {
      setLoadingStudents(true);
      try {
        const [
          { data: studentsData, error: studentsErr },
          { data: resultsData, error: resultsErr },
        ] = await Promise.all([
          supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true }),
          supabase.from('test_results').select('id, test_id, student_id, grade').eq('test_id', testId),
        ]);
        if (studentsErr) throw studentsErr;
        if (resultsErr) throw resultsErr;
        const studentsList = (studentsData ?? []) as StudentRow[];
        setAllStudents(studentsList);
        const newAssigned = new Set<string>();
        const gradeMap: Record<string, GradeInfo> = {};
        (resultsData ?? []).forEach((raw) => {
          const r = raw as TestResultRow;
          newAssigned.add(r.student_id);
          gradeMap[r.student_id] = { grade: r.grade !== null ? String(r.grade) : '', existingResultId: r.id };
        });
        studentsList.forEach((s) => { if (!gradeMap[s.id]) gradeMap[s.id] = { grade: '', existingResultId: undefined }; });
        setAssignedIds(newAssigned);
        setInitialAssignedIds(new Set(newAssigned));
        setGradeByStudent(gradeMap);
      } catch (err) { console.error(err); }
      finally { setLoadingStudents(false); }
    };
    load();
  }, [testId, schoolId]);

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

  const availableStudents = useMemo(() =>
    allStudents.filter((s) => !assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchLeft.toLowerCase())),
    [allStudents, assignedIds, searchLeft]);

  const assignedStudents = useMemo(() =>
    allStudents.filter((s) => assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchRight.toLowerCase())),
    [allStudents, assignedIds, searchRight]);

  // ── Style helpers ──
  const cardCls = `overflow-hidden rounded-2xl border shadow-sm ${
    isDark ? 'border-slate-700/50 bg-slate-950/40' : 'border-slate-200 bg-white'
  }`;

  const colCls = `flex flex-col overflow-hidden rounded-xl border ${
    isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
  }`;

  const colHeaderCls = `flex items-center justify-between border-b px-4 py-3 ${
    isDark ? 'border-slate-800/70' : 'border-slate-200 bg-slate-100'
  }`;

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
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Users className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Βαθμοί διαγωνίσματος
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Επίλεξε ποιοι μαθητές έγραψαν και καταχώρησε βαθμούς.
            </p>
          </div>
        </div>
      </div>

      {/* Test info card */}
      <div className={cardCls}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <ClipboardList className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              {test.title || `${test.subjectName} — ${test.classTitle}`}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Ημερομηνία', value: test.dateDisplay },
              { icon: <Clock className="h-3.5 w-3.5" />, label: 'Ώρα', value: test.timeRange || '—' },
              { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Τμήμα', value: test.classTitle },
              { icon: <Tag className="h-3.5 w-3.5" />, label: 'Μάθημα', value: test.subjectName },
            ].map(({ icon, label, value }) => (
              <div key={label} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span style={{ color: 'var(--color-accent)', opacity: 0.7 }}>{icon}</span>
                  {label}
                </div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grade entry section */}
      <div className={cardCls}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />
        <div className={`flex items-center gap-3 border-b px-5 py-3.5 ${isDark ? 'border-slate-800/70 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
            <Users className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Καταχώρηση βαθμών</h2>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Μετακίνησε μαθητές στα δεξιά και συμπλήρωσε τους βαθμούς τους.
            </p>
          </div>
        </div>

        {loadingStudents ? (
          <div className={`flex items-center justify-center gap-2 py-16 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Loader2 className="h-4 w-4 animate-spin" />Φόρτωση μαθητών...
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{error}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left: all students */}
              <div className={colCls}>
                <div className={colHeaderCls}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Όλοι οι μαθητές</span>
                    <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>
                      {allStudents.length - assignedIds.size}
                    </span>
                  </div>
                  <div className={searchBoxCls}>
                    <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchLeft} onChange={(e) => setSearchLeft(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className={`flex-1 overflow-y-auto ${dividerCls}`} style={{ maxHeight: 320 }}>
                  {availableStudents.length === 0
                    ? <p className={`px-4 py-5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
                    : availableStudents.map((s) => (
                      <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-100/60'}`}>
                        <span className={`truncate text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
                        <button type="button"
                          onClick={() => setAssignedIds((prev) => { const n = new Set(prev); n.add(s.id); return n; })}
                          disabled={saving}
                          className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60">
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right: assigned with grades */}
              <div className={colCls}>
                <div className={colHeaderCls}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Έγραψαν</span>
                    {assignedIds.size > 0 && (
                      <span className="rounded-full px-1.5 py-px text-[10px] tabular-nums"
                        style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                        {assignedIds.size}
                      </span>
                    )}
                  </div>
                  <div className={searchBoxCls}>
                    <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchRight} onChange={(e) => setSearchRight(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className={`flex-1 overflow-y-auto ${dividerCls}`} style={{ maxHeight: 320 }}>
                  {assignedStudents.length === 0
                    ? <p className={`px-4 py-5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές ακόμα.</p>
                    : assignedStudents.map((s) => {
                      const info = gradeByStudent[s.id] ?? { grade: '' };
                      return (
                        <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-100/60'}`}>
                          <button type="button"
                            onClick={() => setAssignedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; })}
                            disabled={saving}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 disabled:opacity-60">
                            <ArrowRight size={13} className="rotate-180" />
                          </button>
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

            {/* Save bar */}
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isDark ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
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
