import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Search, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import type { GradeInfo, StudentRow, TestResultRow, TestResultsModalState } from './types';

type TestResultsModalProps = {
  resultsModal: TestResultsModalState | null;
  schoolId: string | null;
  onClose: () => void;
};

export default function TestResultsModal({ resultsModal, schoolId, onClose }: TestResultsModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [gradeByStudent, setGradeByStudent] = useState<Record<string, GradeInfo>>({});
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');

  const resetState = () => {
    setError(null); setLoading(false); setAllStudents([]); setAssignedIds(new Set());
    setInitialAssignedIds(new Set()); setGradeByStudent({}); setSearchLeft(''); setSearchRight('');
  };

  useEffect(() => {
    if (!resultsModal || !schoolId) { resetState(); return; }
    const fetchData = async () => {
      setError(null); setLoading(true); setAllStudents([]); setAssignedIds(new Set()); setInitialAssignedIds(new Set()); setGradeByStudent({}); setSearchLeft(''); setSearchRight('');
      try {
        const { data: studentsData, error: studentsErr } = await supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true });
        if (studentsErr) throw studentsErr;
        const studentsList = (studentsData ?? []) as StudentRow[];
        setAllStudents(studentsList);
        const { data: resultsData, error: resultsErr } = await supabase.from('test_results').select('id, test_id, student_id, grade').eq('test_id', resultsModal.testId);
        if (resultsErr) throw resultsErr;
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
      finally { setLoading(false); }
    };
    fetchData();
  }, [resultsModal?.testId, schoolId]);

  const handleClose = () => { if (saving) return; onClose(); };

  const handleSave = async () => {
    if (!resultsModal) return;
    for (const studentId of assignedIds) {
      const info = gradeByStudent[studentId]; const gradeTrim = (info?.grade ?? '').trim();
      if (!gradeTrim) { const st = allStudents.find((s) => s.id === studentId); setError(`Συμπληρώστε βαθμό για τον μαθητή "${st?.full_name ?? 'Άγνωστος'}".`); return; }
      if (Number.isNaN(Number(gradeTrim.replace(',', '.')))) { const st = allStudents.find((s) => s.id === studentId); setError(`Μη έγκυρος βαθμός για "${st?.full_name ?? 'Άγνωστος'}".`); return; }
    }
    setSaving(true); setError(null);
    try {
      const inserts: { test_id: string; student_id: string; grade: number }[] = [];
      const updates: { id: string; grade: number }[] = [];
      const deleteIds: string[] = [];
      for (const studentId of assignedIds) {
        const info = gradeByStudent[studentId]; const gradeNum = Number((info?.grade ?? '').trim().replace(',', '.'));
        if (initialAssignedIds.has(studentId)) { if (info?.existingResultId) updates.push({ id: info.existingResultId, grade: gradeNum }); }
        else inserts.push({ test_id: resultsModal.testId, student_id: studentId, grade: gradeNum });
      }
      for (const studentId of initialAssignedIds) {
        if (!assignedIds.has(studentId)) { const info = gradeByStudent[studentId]; if (info?.existingResultId) deleteIds.push(info.existingResultId); }
      }
      if (inserts.length > 0) { const { error: insertErr } = await supabase.from('test_results').insert(inserts); if (insertErr) throw insertErr; }
      for (const upd of updates) { const { error: updateErr } = await supabase.from('test_results').update({ grade: upd.grade }).eq('id', upd.id); if (updateErr) throw updateErr; }
      if (deleteIds.length > 0) { const { error: delErr } = await supabase.from('test_results').delete().in('id', deleteIds); if (delErr) throw delErr; }
      onClose();
    } catch (err) { console.error(err); setError('Αποτυχία αποθήκευσης βαθμών.'); }
    finally { setSaving(false); }
  };

  const availableStudents = useMemo(() =>
    allStudents.filter((s) => !assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchLeft.toLowerCase())),
    [allStudents, assignedIds, searchLeft]);

  const assignedStudents = useMemo(() =>
    allStudents.filter((s) => assignedIds.has(s.id) && (s.full_name ?? '').toLowerCase().includes(searchRight.toLowerCase())),
    [allStudents, assignedIds, searchRight]);

  if (!resultsModal) return null;

  // ── Styles ──
  const modalCardCls = isDark
    ? 'relative w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';
  const modalTitleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';
  const modalSubtitleCls = isDark ? 'mt-0.5 text-[11px] text-slate-400' : 'mt-0.5 text-[11px] text-slate-500';
  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';
  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';
  const resultsColCls = isDark
    ? 'overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/30'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-slate-50';
  const resultsColHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/70 px-3 py-2.5'
    : 'flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2.5';
  const resultsSearchBoxCls = isDark
    ? 'flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1'
    : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1';
  const resultsSearchInputCls = isDark
    ? 'w-24 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-600'
    : 'w-24 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400';
  const resultsDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const resultsRowHoverCls = isDark ? 'flex items-center justify-between px-3 py-2 hover:bg-white/[0.02]' : 'flex items-center justify-between px-3 py-2 hover:bg-slate-100/60';
  const resultsRowHoverAssignedCls = isDark ? 'flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02]' : 'flex items-center gap-2 px-3 py-2 hover:bg-slate-100/60';
  const gradeInputCls = isDark
    ? 'h-7 w-20 shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'h-7 w-20 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]';

  const subtitle = `${resultsModal.subjectName} · ${resultsModal.classTitle}${resultsModal.dateDisplay ? ` · ${resultsModal.dateDisplay}` : ''}${resultsModal.timeRange ? ` · ${resultsModal.timeRange}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <Users className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className={modalTitleCls}>Μαθητές & βαθμοί</h2>
              <p className={modalSubtitleCls}>{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className={modalCloseBtnCls}><X className="h-3.5 w-3.5" /></button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{error}
          </div>
        )}

        <div className="px-6 pb-2">
          {loading ? (
            <div className={`flex items-center justify-center py-10 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Φόρτωση μαθητών και βαθμών...
            </div>
          ) : allStudents.length === 0 ? (
            <p className={`py-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Δεν βρέθηκαν μαθητές. Προσθέστε μαθητές στη σελίδα «Μαθητές».
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Left: available */}
              <div className={resultsColCls}>
                <div className={resultsColHeaderCls}>
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Όλοι οι μαθητές</span>
                  <div className={resultsSearchBoxCls}>
                    <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input className={resultsSearchInputCls} placeholder="Αναζήτηση..." value={searchLeft} onChange={(e) => setSearchLeft(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {availableStudents.length === 0
                    ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
                    : <div className={resultsDivideCls}>{availableStudents.map((s) => (
                      <div key={s.id} className={resultsRowHoverCls}>
                        <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
                        <button type="button" onClick={() => setAssignedIds((prev) => { const n = new Set(prev); n.add(s.id); return n; })} disabled={saving}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60">
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    ))}</div>}
                </div>
              </div>

              {/* Right: assigned */}
              <div className={resultsColCls}>
                <div className={resultsColHeaderCls}>
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Μαθητές που έγραψαν</span>
                  <div className={resultsSearchBoxCls}>
                    <Search className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input className={resultsSearchInputCls} placeholder="Αναζήτηση..." value={searchRight} onChange={(e) => setSearchRight(e.target.value)} disabled={saving} />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {assignedStudents.length === 0
                    ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές.</p>
                    : <div className={resultsDivideCls}>{assignedStudents.map((s) => {
                      const info = gradeByStudent[s.id] ?? { grade: '' };
                      return (
                        <div key={s.id} className={resultsRowHoverAssignedCls}>
                          <button type="button" onClick={() => setAssignedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; })} disabled={saving}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 disabled:opacity-60">
                            <ArrowLeft size={13} />
                          </button>
                          <span className={`flex-1 text-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
                          <input type="text" inputMode="decimal" placeholder="π.χ. 18.5" value={info.grade}
                            onChange={(e) => setGradeByStudent((prev) => ({ ...prev, [s.id]: { grade: e.target.value, existingResultId: prev[s.id]?.existingResultId } }))}
                            className={gradeInputCls} disabled={saving} />
                        </div>
                      );
                    })}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={modalFooterCls}>
          <button type="button" onClick={handleClose} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={handleSave} disabled={saving || loading}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
          </button>
        </div>
      </div>
    </div>
  );
}
