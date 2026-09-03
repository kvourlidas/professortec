import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Search, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
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
  const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set());
  const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set());

  const resetState = () => {
    setError(null); setLoading(false); setAllStudents([]); setAssignedIds(new Set());
    setInitialAssignedIds(new Set()); setGradeByStudent({}); setSearchLeft(''); setSearchRight('');
    setSelectedLeft(new Set()); setSelectedRight(new Set());
  };

  useEffect(() => {
    if (!resultsModal || !schoolId) { resetState(); return; }
    const fetchData = async () => {
      setError(null); setLoading(true); setAllStudents([]); setAssignedIds(new Set()); setInitialAssignedIds(new Set()); setGradeByStudent({}); setSearchLeft(''); setSearchRight(''); setSelectedLeft(new Set()); setSelectedRight(new Set());
      try {
        const { data: studentsData, error: studentsErr } = await supabase.from('students').select('id, school_id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true });
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

  useEscapeToClose(!!resultsModal, onClose);

  if (!resultsModal) return null;

  // ── Styles ──
  const modalCardCls = isDark
    ? 'relative w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';
  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';
  const colCls = isDark
    ? 'overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/30'
    : 'overflow-hidden rounded-xl border border-slate-200 bg-slate-50';
  const colHeaderCls = isDark
    ? 'border-b border-slate-800/70 px-3 py-2.5'
    : 'border-b border-slate-200 bg-slate-100 px-3 py-2.5';
  const searchBoxCls = isDark
    ? 'flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1'
    : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1';
  const searchInputCls = isDark
    ? 'w-24 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-600'
    : 'w-24 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400';
  const divideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const rowCls = `flex items-center gap-2.5 px-3 py-2 transition cursor-pointer select-none ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100/60'}`;
  const gradeInputCls = isDark
    ? 'h-7 w-20 shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'h-7 w-20 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]';
  const checkboxStyle: React.CSSProperties = { accentColor: 'var(--color-accent)', cursor: 'pointer' };

  const subtitle = `${resultsModal.subjectName} · ${resultsModal.classTitle}${resultsModal.dateDisplay ? ` · ${resultsModal.dateDisplay}` : ''}${resultsModal.timeRange ? ` · ${resultsModal.timeRange}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <Users className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Μαθητές & βαθμοί</h2>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
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
              <div className={colCls}>
                <div className={colHeaderCls}>
                  {/* Row 1: title + search */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      Όλοι οι μαθητές
                      {availableStudents.length > 0 && (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{ background: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)', color: isDark ? '#94a3b8' : '#64748b' }}>
                          {availableStudents.length}
                        </span>
                      )}
                    </span>
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
                <div className={`max-h-72 overflow-y-auto ${divideCls}`}>
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
                        <span className={`truncate text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
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
                      Μαθητές που έγραψαν
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
                <div className={`max-h-72 overflow-y-auto ${divideCls}`}>
                  {assignedStudents.length === 0
                    ? <p className={`px-3 py-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν επιλεγεί μαθητές.</p>
                    : assignedStudents.map((s) => {
                      const info = gradeByStudent[s.id] ?? { grade: '' };
                      return (
                        <div key={s.id} className={`flex items-center gap-2 px-3 py-2 transition ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-100/60'}`}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 rounded"
                            style={checkboxStyle}
                            checked={selectedRight.has(s.id)}
                            onChange={() => toggleRight(s.id)}
                            disabled={saving}
                          />
                          <span className={`flex-1 truncate text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name ?? 'Χωρίς όνομα'}</span>
                          <input type="text" inputMode="decimal" placeholder="π.χ. 18.5" value={info.grade}
                            onChange={(e) => setGradeByStudent((prev) => ({ ...prev, [s.id]: { grade: e.target.value, existingResultId: prev[s.id]?.existingResultId } }))}
                            className={gradeInputCls} disabled={saving} />
                        </div>
                      );
                    })}
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
