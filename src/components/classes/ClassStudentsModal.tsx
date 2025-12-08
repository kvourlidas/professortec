import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { ArrowRight, ArrowLeft, Loader2, Search } from 'lucide-react';

type ClassStudentsModalProps = {
  open: boolean;
  onClose: () => void;
  classId: string | null;
  classTitle?: string;
};

type StudentRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

export default function ClassStudentsModal({
  open,
  onClose,
  classId,
  classTitle,
}: ClassStudentsModalProps) {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
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
    if (!open || !classId || !schoolId) return;

    const load = async () => {
      setLoading(true);
      setLocalError(null);

      try {
        // Όλοι οι μαθητές του σχολείου
        const { data: studentsData, error: studentsErr } = await supabase
          .from('students')
          .select('id, school_id, full_name')
          .eq('school_id', schoolId)
          .order('full_name', { ascending: true });

        if (studentsErr) throw studentsErr;
        const students = (studentsData ?? []) as StudentRow[];
        setAllStudents(students);

        // Assigned στον συγκεκριμένο class
        const { data: csData, error: csErr } = await supabase
          .from('class_students')
          .select('student_id')
          .eq('school_id', schoolId)
          .eq('class_id', classId);

        if (csErr) throw csErr;

        const currentIds = new Set<string>(
          (csData ?? []).map((r: any) => r.student_id),
        );
        setAssignedIds(currentIds);
        setInitialAssignedIds(currentIds);
      } catch (err) {
        console.error('Error loading class students', err);
        setLocalError('Σφάλμα κατά τη φόρτωση των μαθητών.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, classId, schoolId]);

  const availableStudents = useMemo(
    () =>
      allStudents.filter(
        (s) =>
          !assignedIds.has(s.id) &&
          (s.full_name ?? '')
            .toLowerCase()
            .includes(searchLeft.toLowerCase()),
      ),
    [allStudents, assignedIds, searchLeft],
  );

  const assignedStudents = useMemo(
    () =>
      allStudents
        .filter((s) => assignedIds.has(s.id))
        .filter((s) =>
          (s.full_name ?? '')
            .toLowerCase()
            .includes(searchRight.toLowerCase()),
        ),
    [allStudents, assignedIds, searchRight],
  );

  // ➜ ΜΟΝΟ UI: βάζει μαθητή στο τμήμα (δεξιά λίστα)
  const handleAddLocal = (studentId: string) => {
    if (saving) return;
    setAssignedIds((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  };

  // ⬅ ΜΟΝΟ UI: βγάζει μαθητή από το τμήμα (πίσω στην αριστερή λίστα)
  const handleRemoveLocal = (studentId: string) => {
    if (saving) return;
    setAssignedIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  // Ακύρωση → γυρνάμε την τοπική κατάσταση όπως ήταν αρχικά & κλείνουμε
  const handleCancel = () => {
    setAssignedIds(new Set(initialAssignedIds));
    onClose();
  };

  // ✅ ΕΔΩ ΜΟΝΟ γράφουμε στη βάση
  const handleSave = async () => {
    if (!schoolId || !classId) {
      onClose();
      return;
    }

    setLocalError(null);
    setSaving(true);

    try {
      const toAdd: string[] = [];
      const toRemove: string[] = [];

      // νέοι μαθητές στο τμήμα
      assignedIds.forEach((id) => {
        if (!initialAssignedIds.has(id)) toAdd.push(id);
      });

      // μαθητές που αφαιρέθηκαν
      initialAssignedIds.forEach((id) => {
        if (!assignedIds.has(id)) toRemove.push(id);
      });

      if (toAdd.length === 0 && toRemove.length === 0) {
        setSaving(false);
        onClose();
        return;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((studentId) => ({
          school_id: schoolId,
          class_id: classId,
          student_id: studentId,
        }));

        const { error: addErr } = await supabase
          .from('class_students')
          .insert(rows);

        if (addErr) throw addErr;
      }

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('class_students')
          .delete()
          .eq('school_id', schoolId)
          .eq('class_id', classId)
          .in('student_id', toRemove);

        if (delErr) throw delErr;
      }

      // ενημερώνουμε το "baseline" και κλείνουμε
      setInitialAssignedIds(new Set(assignedIds));
      setSaving(false);
      onClose();
    } catch (err) {
      console.error('Save class students error', err);
      setSaving(false);
      setLocalError('Δεν ήταν δυνατή η αποθήκευση των αλλαγών.');
    }
  };

  if (!open || !classId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-4xl rounded-xl p-5 shadow-xl border border-slate-700"
        style={{ background: 'var(--color-sidebar)' }}
      >
        {/* Header – ίδιο mood με ClassFormModal */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Μαθητές τμήματος
            </h2>
            {classTitle && (
              <p className="mt-1 text-xs text-slate-400">
                Τμήμα: {classTitle}
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

        {/* Body – δύο κάρτες */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-200">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Φόρτωση μαθητών...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left: όλοι οι μαθητές */}
            <div className="rounded-md border border-slate-700 bg-slate-950/40">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  Όλοι οι μαθητές
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
                {availableStudents.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-slate-500">
                    Δεν υπάρχουν διαθέσιμοι μαθητές.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {availableStudents.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-xs text-slate-100">
                          {s.full_name ?? 'Χωρίς όνομα'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddLocal(s.id)}
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

            {/* Right: μαθητές στο τμήμα */}
            <div className="rounded-md border border-slate-700 bg-slate-950/40">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <h3 className="text-xs font-semibold text-slate-100">
                  Μαθητές στο τμήμα
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
                {assignedStudents.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-slate-500">
                    Δεν έχουν προστεθεί μαθητές στο τμήμα.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {assignedStudents.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveLocal(s.id)}
                          disabled={saving}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <span className="ml-2 text-xs text-slate-100">
                          {s.full_name ?? 'Χωρίς όνομα'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer – ίδιο ύφος με ClassFormModal */}
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
