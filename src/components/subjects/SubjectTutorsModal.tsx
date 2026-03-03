// src/components/subjects/SubjectTutorsModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
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
  const schoolId = profile?.school_id ?? null;

  const [allTutors, setAllTutors] = useState<TutorRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !subjectId || !schoolId) return;
    const load = async () => {
      setLoading(true); setLocalError(null);
      try {
        const { data: tutorsData, error: tutorsErr } = await supabase
          .from('tutors').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true });
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

  const handleAddLocal = (tutorId: string) => {
    if (saving) return;
    setAssignedIds((prev) => { const n = new Set(prev); n.add(tutorId); return n; });
  };

  const handleRemoveLocal = (tutorId: string) => {
    if (saving) return;
    setAssignedIds((prev) => { const n = new Set(prev); n.delete(tutorId); return n; });
  };

  const handleCancel = () => { setAssignedIds(new Set(initialAssignedIds)); onClose(); };

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

  if (!open || !subjectId) return null;

  const pendingChanges =
    [...assignedIds].filter((id) => !initialAssignedIds.has(id)).length +
    [...initialAssignedIds].filter((id) => !assignedIds.has(id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
        {/* Accent bar */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <Users className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Καθηγητές μαθήματος</h2>
              {subjectName && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-slate-500" />
                  <p className="text-[11px] text-slate-400">{subjectName}</p>
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
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {localError && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{localError}
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            <p className="text-xs text-slate-400">Φόρτωση καθηγητών...</p>
          </div>
        ) : (
          <div className="grid gap-3 px-6 pb-2 md:grid-cols-2">

            {/* Left panel — available */}
            <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
              <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/30 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5">
                  <UserMinus className="h-3.5 w-3.5 text-slate-400" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Διαθέσιμοι</h3>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {availableTutors.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                  <input
                    className="h-7 w-32 rounded-lg border border-slate-700/60 bg-slate-800/60 pl-6 pr-2 text-[11px] text-slate-200 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20"
                    placeholder="Αναζήτηση..."
                    value={searchLeft}
                    onChange={(e) => setSearchLeft(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {availableTutors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <Users className="h-5 w-5 text-slate-600" />
                    <p className="text-[11px] text-slate-500">Δεν υπάρχουν διαθέσιμοι καθηγητές.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800/50 p-1">
                    {availableTutors.map((t) => (
                      <li key={t.id} className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition hover:bg-slate-800/50">
                        <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors">{t.full_name ?? 'Χωρίς όνομα'}</span>
                        <button type="button" onClick={() => handleAddLocal(t.id)} disabled={saving}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40">
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right panel — assigned */}
            <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
              <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/30 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>Στο μάθημα</h3>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                    {assignedTutors.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                  <input
                    className="h-7 w-32 rounded-lg border border-slate-700/60 bg-slate-800/60 pl-6 pr-2 text-[11px] text-slate-200 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20"
                    placeholder="Αναζήτηση..."
                    value={searchRight}
                    onChange={(e) => setSearchRight(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {assignedTutors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <UserCheck className="h-5 w-5 text-slate-600" />
                    <p className="text-[11px] text-slate-500">Δεν έχουν προστεθεί καθηγητές.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800/50 p-1">
                    {assignedTutors.map((t) => (
                      <li key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-slate-800/50">
                        <button type="button" onClick={() => handleRemoveLocal(t.id)} disabled={saving}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:border-red-400 hover:bg-red-500/20 disabled:opacity-40">
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors">{t.full_name ?? 'Χωρίς όνομα'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3">
          <p className="text-[11px] text-slate-500">
            {pendingChanges > 0
              ? <span style={{ color: 'var(--color-accent)' }}>{pendingChanges} αλλαγές εκκρεμούν</span>
              : 'Δεν υπάρχουν εκκρεμείς αλλαγές'}
          </p>
          <div className="flex gap-2.5">
            <button type="button" onClick={handleCancel} disabled={saving}
              className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
              Ακύρωση
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}