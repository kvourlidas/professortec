// src/components/subjects/SubjectTutorsModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { ArrowRight, ArrowLeft, Loader2, Search } from 'lucide-react';

type SubjectTutorsModalProps = {
  open: boolean;
  onClose: () => void;
  subjectId: string | null;
  subjectName: string;
  onChanged?: () => void;
};

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

export default function SubjectTutorsModal({
  open,
  onClose,
  subjectId,
  subjectName,
  onChanged,
}: SubjectTutorsModalProps) {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [allTutors, setAllTutors] = useState<TutorRow[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [initialAssignedIds, setInitialAssignedIds] = useState<Set<string>>(
    new Set(),
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchLeft, setSearchLeft] = useState('');
  const [searchRight, setSearchRight] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !subjectId || !schoolId) return;

    const load = async () => {
      setLoading(true);
      setLocalError(null);

      try {
        const { data: tutorsData, error: tutorsErr } = await supabase
          .from('tutors')
          .select('id, school_id, full_name')
          .eq('school_id', schoolId)
          .order('full_name', { ascending: true });

        if (tutorsErr) throw tutorsErr;
        const tutors = (tutorsData ?? []) as TutorRow[];
        setAllTutors(tutors);

        const { data: stData, error: stErr } = await supabase
          .from('subject_tutors')
          .select('tutor_id')
          .eq('school_id', schoolId)
          .eq('subject_id', subjectId);

        if (stErr) throw stErr;

        const currentIds = new Set<string>(
          (stData ?? []).map((r: any) => r.tutor_id),
        );
        setAssignedIds(currentIds);
        setInitialAssignedIds(currentIds);
      } catch (err) {
        console.error('Error loading subject tutors', err);
        setLocalError('Σφάλμα κατά τη φόρτωση των καθηγητών.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, subjectId, schoolId]);

  const availableTutors = useMemo(
    () =>
      allTutors.filter(
        (t) =>
          !assignedIds.has(t.id) &&
          (t.full_name ?? '')
            .toLowerCase()
            .includes(searchLeft.toLowerCase()),
      ),
    [allTutors, assignedIds, searchLeft],
  );

  const assignedTutors = useMemo(
    () =>
      allTutors
        .filter((t) => assignedIds.has(t.id))
        .filter((t) =>
          (t.full_name ?? '')
            .toLowerCase()
            .includes(searchRight.toLowerCase()),
        ),
    [allTutors, assignedIds, searchRight],
  );

  const handleAddLocal = (tutorId: string) => {
    if (saving) return;
    setAssignedIds((prev) => {
      const next = new Set(prev);
      next.add(tutorId);
      return next;
    });
  };

  const handleRemoveLocal = (tutorId: string) => {
    if (saving) return;
    setAssignedIds((prev) => {
      const next = new Set(prev);
      next.delete(tutorId);
      return next;
    });
  };

  const handleCancel = () => {
    setAssignedIds(new Set(initialAssignedIds));
    onClose();
  };

  const handleSave = async () => {
    if (!schoolId || !subjectId) {
      onClose();
      return;
    }

    setLocalError(null);
    setSaving(true);

    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      assignedIds.forEach((id) => {
        if (!initialAssignedIds.has(id)) toAdd.push(id);
      });

      initialAssignedIds.forEach((id) => {
        if (!assignedIds.has(id)) toRemove.push(id);
      });

      if (toAdd.length === 0 && toRemove.length === 0) {
        setSaving(false);
        onClose();
        return;
      }

      // 🔹 UPSERT για αποφυγή duplicate key error
      if (toAdd.length > 0) {
        const rows = toAdd.map((tutorId) => ({
          school_id: schoolId,
          subject_id: subjectId,
          tutor_id: tutorId,
        }));

        const { error: addErr } = await supabase
          .from('subject_tutors')
          .upsert(rows, {
            onConflict: 'school_id,subject_id,tutor_id',
          });

        if (addErr) throw addErr;
      }

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('subject_tutors')
          .delete()
          .eq('school_id', schoolId)
          .eq('subject_id', subjectId)
          .in('tutor_id', toRemove);

        if (delErr) throw delErr;
      }

      setInitialAssignedIds(new Set(assignedIds));
      setSaving(false);
      onChanged?.(); // ⭐ ενημέρωση parent για reload
      onClose();
    } catch (err) {
      console.error('Save subject tutors error', err);
      setSaving(false);
      setLocalError('Δεν ήταν δυνατή η αποθήκευση των αλλαγών.');
    }
  };

  if (!open || !subjectId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-4xl rounded-xl p-5 shadow-xl border border-slate-700"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Καθηγητές μαθήματος
            </h2>
            {subjectName && (
              <p className="mt-1 text-xs text-slate-400">
                Μάθημα: {subjectName}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-xs">
            Κλείσιμο
          </button>
        </div>

        {localError && (
          <div className="mb-3 rounded-lg bg-amber-900/60 px-3 py-2 text-xs text-amber-100">
            {localError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-200">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Φόρτωση καθηγητών...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left: όλοι οι καθηγητές */}
            <div className="rounded-md border border-slate-700 bg-slate-950/40">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  Όλοι οι καθηγητές
                </h3>
                <div className="flex items-center rounded border border-slate-600 bg-slate-900 px-2">
                  <Search className="mr-1 h-3 w-3 text-slate-400" />
                  <input
                    className="w-28 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
                    placeholder="Αναζήτηση..."
                    value={searchLeft}
                    onChange={(e) => setSearchLeft(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {availableTutors.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-slate-500">
                    Δεν υπάρχουν διαθέσιμοι καθηγητές.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {availableTutors.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-xs text-slate-100">
                          {t.full_name ?? 'Χωρίς όνομα'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddLocal(t.id)}
                          disabled={saving}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-60"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right: καθηγητές στο μάθημα */}
            <div className="rounded-md border border-slate-700 bg-slate-950/40">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  Καθηγητές στο μάθημα
                </h3>
                <div className="flex items-center rounded border border-slate-600 bg-slate-900 px-2">
                  <Search className="mr-1 h-3 w-3 text-slate-400" />
                  <input
                    className="w-28 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
                    placeholder="Αναζήτηση..."
                    value={searchRight}
                    onChange={(e) => setSearchRight(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {assignedTutors.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-slate-500">
                    Δεν έχουν προστεθεί καθηγητές στο μάθημα.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {assignedTutors.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveLocal(t.id)}
                          disabled={saving}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <span className="ml-2 text-xs text-slate-100">
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

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="btn-ghost"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text-main)',
            }}
          >
            Ακύρωση
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Αποθήκευση...
              </span>
            ) : (
              'Αποθήκευση'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
