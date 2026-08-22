import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ClipboardList, Loader2, Search, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';

type StudentRow = { id: string; school_id: string; full_name: string };
type TestResultRow = { id: string; test_id: string; student_id: string; grade: number | null };
type GradeInfo = { grade: string; existingResultId: string | undefined };

type TestItem = {
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

type GradeEntryModalProps = {
  schoolId: string;
  onClose: () => void;
  onSaved?: () => void;
};

export default function GradeEntryModal({ schoolId, onClose, onSaved }: GradeEntryModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [phase, setPhase] = useState<1 | 2>(1);
  const [loadingTests, setLoadingTests] = useState(true);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [gradeByStudent, setGradeByStudent] = useState<Record<string, GradeInfo>>({});
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set());
  const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoadingTests(true);
      try {
        const [
          { data: testsData },
          { data: classesData },
          { data: subjectsData },
        ] = await Promise.all([
          supabase.from('tests').select('id, class_id, subject_id, test_date, start_time, end_time, title').eq('school_id', schoolId).order('test_date', { ascending: false }),
          supabase.from('classes').select('id, title').eq('school_id', schoolId),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
        ]);
        const classById = new Map<string, string>((classesData ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
        const subjById = new Map<string, string>((subjectsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
        const enriched: TestItem[] = (testsData ?? []).map((t: {
          id: string; class_id: string; subject_id: string; test_date: string;
          start_time: string | null; end_time: string | null; title: string | null;
        }) => ({
          id: t.id,
          class_id: t.class_id,
          subject_id: t.subject_id,
          test_date: t.test_date,
          start_time: t.start_time,
          end_time: t.end_time,
          title: t.title,
          classTitle: classById.get(t.class_id) ?? '—',
          subjectName: subjById.get(t.subject_id) ?? '—',
          dateDisplay: new Date(t.test_date).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          timeRange: t.start_time && t.end_time ? `${t.start_time.slice(0, 5)} – ${t.end_time.slice(0, 5)}` : '',
        }));
        setTests(enriched);
      } catch (err) { console.error(err); }
      finally { setLoadingTests(false); }
    };
    load();
  }, [schoolId]);

  const handleSelectTest = async (test: TestItem) => {
    setSelectedTest(test);
    setPhase(2);
    setError(null);
    setLoadingStudents(true);
    setAllStudents([]);
    setAssignedIds(new Set());
    setInitialAssignedIds(new Set());
    setGradeByStudent({});
    setSearchLeft('');
    setSearchRight('');
    setSelectedLeft(new Set());
    setSelectedRight(new Set());
    try {
      const [
        { data: studentsData, error: studentsErr },
        { data: resultsData, error: resultsErr },
      ] = await Promise.all([
        supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }),
        supabase.from('test_results').select('id, test_id, student_id, grade').eq('test_id', test.id),
      ]);
      if (studentsErr) throw studentsErr;
      if (resultsErr) throw resultsErr;
      const studentsList = (studentsData ?? []) as StudentRow[];
      setAllStudents(studentsList);
      const newAssignedIds = new Set<string>();
      const gradeMap: Record<string, GradeInfo> = {};
      (resultsData ?? []).forEach((raw) => {
        const r = raw as TestResultRow;
        newAssignedIds.add(r.student_id);
        gradeMap[r.student_id] = { grade: r.grade !== null ? String(r.grade) : '', existingResultId: r.id };
      });
      studentsList.forEach((s) => { if (!gradeMap[s.id]) gradeMap[s.id] = { grade: '', existingResultId: undefined }; });
      setAssignedIds(newAssignedIds);
      setInitialAssignedIds(new Set(newAssignedIds));
      setGradeByStudent(gradeMap);
    } catch (err) { console.error(err); setError('Αποτυχία φόρτωσης.'); }
    finally { setLoadingStudents(false); }
  };

  const handleBackToPhase1 = () => {
    if (saving) return;
    setPhase(1);
    setSelectedTest(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedTest) return;
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
    setError(null);
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
          inserts.push({ test_id: selectedTest.id, student_id: studentId, grade: gradeNum });
        }
      }
      for (const studentId of initialAssignedIds) {
        if (!assignedIds.has(studentId)) {
          const info = gradeByStudent[studentId];
          if (info?.existingResultId) deleteIds.push(info.existingResultId);
        }
      }
      if (inserts.length > 0) { const { error: insertErr } = await supabase.from('test_results').insert(inserts); if (insertErr) throw insertErr; }
      for (const upd of updates) { const { error: updateErr } = await supabase.from('test_results').update({ grade: upd.grade }).eq('id', upd.id); if (updateErr) throw updateErr; }
      if (deleteIds.length > 0) { const { error: delErr } = await supabase.from('test_results').delete().in('id', deleteIds); if (delErr) throw delErr; }
      onSaved?.();
      onClose();
    } catch (err) { console.error(err); setError('Αποτυχία αποθήκευσης βαθμών.'); }
    finally { setSaving(false); }
  };

  const filteredTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) =>
      [t.dateDisplay, t.classTitle, t.subjectName, t.title ?? '', t.timeRange].some((v) => v.toLowerCase().includes(q))
    );
  }, [tests, testSearch]);

  const availableStudents = useMemo(() =>
    allStudents.filter((s) => !assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchLeft.toLowerCase())),
    [allStudents, assignedIds, searchLeft]);

  const assignedStudents = useMemo(() =>
    allStudents.filter((s) => assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchRight.toLowerCase())),
    [allStudents, assignedIds, searchRight]);

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

  const handleClose = () => { if (saving) return; onClose(); };

  const cardCls = `relative w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`;
  const colCls = `overflow-hidden rounded-xl border ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const colHeaderCls = `border-b px-3 py-2.5 ${isDark ? 'border-slate-800/70' : 'border-slate-200 bg-slate-100'}`;
  const searchBoxCls = `flex items-center gap-1.5 rounded-lg border px-2 py-1 ${isDark ? 'border-slate-700/60 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const searchInputCls = `w-24 bg-transparent text-[11px] outline-none ${isDark ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`;
  const gradeInputCls = `h-7 w-20 shrink-0 rounded-lg border px-2 text-xs outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'}`;
  const dividerCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-50 ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'}`;
  const cancelBtnCls = `rounded-lg border px-4 py-1.5 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
  const checkboxStyle: React.CSSProperties = { accentColor: 'var(--color-accent)', cursor: 'pointer' };
  const rowCls = `flex items-center gap-2.5 px-3 py-2 transition cursor-pointer select-none ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100/60'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={cardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            {phase === 2 && (
              <button type="button" onClick={handleBackToPhase1} disabled={saving} className={closeBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              {phase === 1
                ? <ClipboardList className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
                : <Users className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />}
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
                {phase === 1 ? 'Καταχώρηση βαθμών' : 'Μαθητές & βαθμοί'}
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>
                {phase === 1
                  ? 'Επίλεξε διαγώνισμα για να καταχωρήσεις βαθμούς.'
                  : `${selectedTest?.subjectName} · ${selectedTest?.classTitle}${selectedTest?.dateDisplay ? ` · ${selectedTest.dateDisplay}` : ''}${selectedTest?.timeRange ? ` · ${selectedTest.timeRange}` : ''}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={saving}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-50"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{error}
          </div>
        )}

        {/* Phase 1: Test picker */}
        {phase === 1 && (
          <div className="px-6 py-4">
            <div className="relative mb-3">
              <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                className={`h-9 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'}`}
                placeholder="Αναζήτηση διαγωνίσματος..."
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
              />
            </div>

            <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
              {loadingTests ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className={`h-4 w-4 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>
              ) : filteredTests.length === 0 ? (
                <p className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν διαγωνίσματα.</p>
              ) : (
                <div className={`max-h-72 overflow-y-auto grades-scroll ${dividerCls}`}>
                  {filteredTests.map((t) => (
                    <button key={t.id} type="button" onClick={() => handleSelectTest(t)}
                      className={`group flex w-full items-center justify-between px-4 py-3 text-left transition ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-medium truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t.title || t.subjectName}</div>
                        <div className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {t.classTitle} · {t.subjectName}{t.dateDisplay ? ` · ${t.dateDisplay}` : ''}{t.timeRange ? ` · ${t.timeRange}` : ''}
                        </div>
                      </div>
                      <ArrowRight className={`ml-3 h-4 w-4 shrink-0 transition-colors ${isDark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-300 group-hover:text-slate-500'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleClose} className={cancelBtnCls}>Ακύρωση</button>
            </div>
          </div>
        )}

        {/* Phase 2: Grade entry */}
        {phase === 2 && (
          <>
            <div className="px-6 py-4">
              {loadingStudents ? (
                <div className={`flex items-center justify-center py-10 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Φόρτωση μαθητών...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">

                  {/* Left: available students */}
                  <div className={colCls}>
                    <div className={colHeaderCls}>
                      {/* Row 1: title + search */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Όλοι οι μαθητές</span>
                        <div className={searchBoxCls}>
                          <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchLeft} onChange={(e) => setSearchLeft(e.target.value)} disabled={saving} />
                        </div>
                      </div>
                      {/* Row 2: select-all + move button */}
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
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-30 active:scale-95"
                          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                          {visibleLeftSelected.length > 0 ? `Προσθήκη (${visibleLeftSelected.length})` : 'Προσθήκη'}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className={`max-h-56 overflow-y-auto grades-scroll ${dividerCls}`}>
                      {availableStudents.length === 0
                        ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
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
                            <span className={`truncate text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Right: assigned with grade inputs */}
                  <div className={colCls}>
                    <div className={colHeaderCls}>
                      {/* Row 1: title + search */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          Έγραψαν
                          {assignedIds.size > 0 && (
                            <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
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
                      {/* Row 2: move button + select-all */}
                      <div className="mt-2 flex items-center justify-between">
                        <button type="button" onClick={moveToAvailable}
                          disabled={saving || visibleRightSelected.length === 0}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-30 active:scale-95"
                          style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#f87171' : '#dc2626', border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.20)'}` }}>
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
                    <div className={`max-h-56 overflow-y-auto grades-scroll ${dividerCls}`}>
                      {assignedStudents.length === 0
                        ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές.</p>
                        : assignedStudents.map((s) => {
                          const info = gradeByStudent[s.id] ?? { grade: '' };
                          const isChecked = selectedRight.has(s.id);
                          return (
                            <div key={s.id} className={`flex items-center gap-2 px-3 py-2 transition ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-100/60'}`}>
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 shrink-0 rounded"
                                style={checkboxStyle}
                                checked={isChecked}
                                onChange={() => toggleRight(s.id)}
                                disabled={saving}
                              />
                              <span className={`flex-1 truncate text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
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
            </div>

            <div className={`flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
              <button type="button" onClick={handleClose} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
              <button type="button" onClick={handleSave} disabled={saving || loadingStudents}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
