// src/components/subjects/SubjectTutorsModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  ArrowRight, ArrowLeft, Loader2, Search,
  Users, X, BookOpen, UserCheck, UserMinus,
} from 'lucide-react';

type SubjectTutorsModalProps = {
  open: boolean;
  onClose: () => void;
  subjectId: string | null;
  subjectName: string;
  onChanged?: () => void;
};

type TutorRow = { id: string; school_id: string; full_name: string | null };

export default function SubjectTutorsModal({
  open, onClose, subjectId, subjectName, onChanged,
}: SubjectTutorsModalProps) {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [allTutors, setAllTutors] = useState<TutorRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set());
  const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !subjectId || !schoolId) return;
    const load = async () => {
      setLoading(true); setLocalError(null);
      setSelectedLeft(new Set()); setSelectedRight(new Set());
      try {
        const { data: tutorsData, error: tutorsErr } = await supabase
          .from('tutors').select('id, school_id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true });
        if (tutorsErr) throw tutorsErr;
        setAllTutors((tutorsData ?? []) as TutorRow[]);

        const { data: stData, error: stErr } = await supabase
          .from('subject_tutors').select('tutor_id').eq('school_id', schoolId).eq('subject_id', subjectId);
        if (stErr) throw stErr;

        const currentIds = new Set<string>((stData ?? []).map((r: any) => r.tutor_id));
        setAssignedIds(currentIds);
        setInitialAssignedIds(currentIds);
      } catch (err) {
        console.error('Error loading subject tutors', err);
        setLocalError('Σφάλμα κατά τη φόρτωση των καθηγητών.');
      } finally { setLoading(false); }
    };
    load();
  }, [open, subjectId, schoolId]);

  const availableTutors = useMemo(() =>
    allTutors.filter((t) => !assignedIds.has(t.id) && (t.full_name ?? '').toLowerCase().includes(searchLeft.toLowerCase())),
    [allTutors, assignedIds, searchLeft]);

  const assignedTutors = useMemo(() =>
    allTutors.filter((t) => assignedIds.has(t.id)).filter((t) => (t.full_name ?? '').toLowerCase().includes(searchRight.toLowerCase())),
    [allTutors, assignedIds, searchRight]);

  // Selection helpers
  const visibleLeftSelected = availableTutors.filter(t => selectedLeft.has(t.id));
  const visibleRightSelected = assignedTutors.filter(t => selectedRight.has(t.id));
  const allLeftChecked = availableTutors.length > 0 && availableTutors.every(t => selectedLeft.has(t.id));
  const someLeftChecked = availableTutors.some(t => selectedLeft.has(t.id)) && !allLeftChecked;
  const allRightChecked = assignedTutors.length > 0 && assignedTutors.every(t => selectedRight.has(t.id));
  const someRightChecked = assignedTutors.some(t => selectedRight.has(t.id)) && !allRightChecked;

  const toggleLeft = (id: string) => setSelectedLeft(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleRight = (id: string) => setSelectedRight(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllLeft = () => {
    if (allLeftChecked) setSelectedLeft(new Set());
    else setSelectedLeft(new Set(availableTutors.map(t => t.id)));
  };
  const toggleAllRight = () => {
    if (allRightChecked) setSelectedRight(new Set());
    else setSelectedRight(new Set(assignedTutors.map(t => t.id)));
  };

  const moveToAssigned = () => {
    if (saving || visibleLeftSelected.length === 0) return;
    setAssignedIds(prev => { const n = new Set(prev); visibleLeftSelected.forEach(t => n.add(t.id)); return n; });
    setSelectedLeft(new Set());
  };
  const moveToAvailable = () => {
    if (saving || visibleRightSelected.length === 0) return;
    setAssignedIds(prev => { const n = new Set(prev); visibleRightSelected.forEach(t => n.delete(t.id)); return n; });
    setSelectedRight(new Set());
  };

  const handleCancel = () => { setAssignedIds(new Set(initialAssignedIds)); setSelectedLeft(new Set()); setSelectedRight(new Set()); onClose(); };

  const handleSave = async () => {
    if (!schoolId || !subjectId) { onClose(); return; }
    setLocalError(null); setSaving(true);
    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];
      assignedIds.forEach((id) => { if (!initialAssignedIds.has(id)) toAdd.push(id); });
      initialAssignedIds.forEach((id) => { if (!assignedIds.has(id)) toRemove.push(id); });

      if (toAdd.length === 0 && toRemove.length === 0) { setSaving(false); onClose(); return; }

      if (toAdd.length > 0) {
        const { error: addErr } = await supabase.from('subject_tutors')
          .upsert(toAdd.map((tutorId) => ({ school_id: schoolId, subject_id: subjectId, tutor_id: tutorId })),
            { onConflict: 'school_id,subject_id,tutor_id' });
        if (addErr) throw addErr;
      }
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase.from('subject_tutors')
          .delete().eq('school_id', schoolId).eq('subject_id', subjectId).in('tutor_id', toRemove);
        if (delErr) throw delErr;
      }

      setInitialAssignedIds(new Set(assignedIds));
      setSaving(false);
      onChanged?.();
      onClose();
    } catch (err) {
      console.error('Save subject tutors error', err);
      setSaving(false);
      setLocalError('Δεν ήταν δυνατή η αποθήκευση των αλλαγών.');
    }
  };

  useEscapeToClose(open, onClose);

  if (!open || !subjectId) return null;

  const pendingChanges =
    [...assignedIds].filter((id) => !initialAssignedIds.has(id)).length +
    [...initialAssignedIds].filter((id) => !assignedIds.has(id)).length;

  // ── Theme classes ──
  const modalBg = isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white';
  const searchInputCls = `h-7 w-28 rounded-lg border pl-6 pr-2 text-[11px] outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/20 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-200 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-700 placeholder-slate-400'}`;
  const listDivideCls = `divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`;
  const footerCls = `mt-3 flex items-center justify-between gap-3 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  const scrollStyle: React.CSSProperties = { scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(71,85,105,0.35) transparent' : 'rgba(203,213,225,0.7) transparent' };
  const checkboxStyle: React.CSSProperties = { accentColor: 'var(--color-accent)', cursor: 'pointer' };
  const rowHoverCls = isDark ? 'transition-colors hover:bg-[color:var(--color-accent)]/[0.12]' : 'transition-colors hover:bg-[color:var(--color-accent)]/10';
  const rowCls = `flex items-center gap-2.5 px-2 py-2 cursor-pointer select-none ${rowHoverCls}`;
  const sectionLabelCls = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <Users className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Καθηγητές μαθήματος</h2>
              {subjectName && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <BookOpen className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <p className="text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>{subjectName}</p>
                  {pendingChanges > 0 && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>
                      {pendingChanges} αλλαγές
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {localError && (
          <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-amber-500/30 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            {localError}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Φόρτωση καθηγητών...</p>
          </div>
        ) : (
          <div className={`grid gap-6 px-6 pt-4 pb-2 md:grid-cols-2 md:gap-x-0 md:divide-x ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>

            {/* Left panel — available */}
            <div className="md:pr-6">
              {/* Row 1: title + search */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserMinus className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <h3 className={sectionLabelCls}>Διαθέσιμοι</h3>
                  <span className={`text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {availableTutors.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
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
                    disabled={saving || availableTutors.length === 0}
                  />
                  Επιλογή όλων
                </label>
                <button type="button" onClick={moveToAssigned}
                  disabled={saving || visibleLeftSelected.length === 0}
                  className="flex items-center gap-1 text-[11px] font-semibold transition hover:underline disabled:opacity-30"
                  style={{ color: 'var(--color-accent)' }}>
                  {visibleLeftSelected.length > 0 ? `Προσθήκη (${visibleLeftSelected.length})` : 'Προσθήκη'}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto" style={scrollStyle}>
                {availableTutors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <Users className={`h-5 w-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν διαθέσιμοι καθηγητές.</p>
                  </div>
                ) : (
                  <ul className={listDivideCls} style={{ borderTop: '2px solid var(--color-accent)' }}>
                    {availableTutors.map((t) => (
                      <li key={t.id} className={rowCls} onClick={() => !saving && toggleLeft(t.id)}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 shrink-0 rounded"
                          style={checkboxStyle}
                          checked={selectedLeft.has(t.id)}
                          onChange={() => toggleLeft(t.id)}
                          onClick={e => e.stopPropagation()}
                          disabled={saving}
                        />
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                          {t.full_name ?? 'Χωρίς όνομα'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right panel — assigned */}
            <div className="md:pl-6">
              {/* Row 1: title + search */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                  <h3 className={sectionLabelCls}>Στο μάθημα</h3>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                    {assignedTutors.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                  <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchRight} onChange={(e) => setSearchRight(e.target.value)} disabled={saving} />
                </div>
              </div>
              {/* Row 2: move button + select-all */}
              <div className="mt-2 flex items-center justify-between">
                <button type="button" onClick={moveToAvailable}
                  disabled={saving || visibleRightSelected.length === 0}
                  className={`flex items-center gap-1 text-[11px] font-semibold transition hover:underline disabled:opacity-30 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
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
                    disabled={saving || assignedTutors.length === 0}
                  />
                  Επιλογή όλων
                </label>
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto" style={scrollStyle}>
                {assignedTutors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <UserCheck className={`h-5 w-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν προστεθεί καθηγητές.</p>
                  </div>
                ) : (
                  <ul className={listDivideCls} style={{ borderTop: '2px solid var(--color-accent)' }}>
                    {assignedTutors.map((t) => (
                      <li key={t.id} className={rowCls} onClick={() => !saving && toggleRight(t.id)}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 shrink-0 rounded"
                          style={checkboxStyle}
                          checked={selectedRight.has(t.id)}
                          onChange={() => toggleRight(t.id)}
                          onClick={e => e.stopPropagation()}
                          disabled={saving}
                        />
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                          {t.full_name ?? 'Χωρίς όνομα'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={footerCls}>
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {pendingChanges > 0
              ? <span style={{ color: 'var(--color-accent)' }}>{pendingChanges} αλλαγές εκκρεμούν</span>
              : 'Δεν υπάρχουν εκκρεμείς αλλαγές'}
          </p>
          <div className="flex gap-2.5">
            <button type="button" onClick={handleCancel} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {saving ? (<><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>) : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
