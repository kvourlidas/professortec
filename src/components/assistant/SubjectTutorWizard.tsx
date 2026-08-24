import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';

type TutorOption = { id: string; full_name: string };

type Props = {
  subjectId: string;
  subjectName: string;
  schoolId: string;
  isDark: boolean;
  onDone: (assignedNames: string[] | null) => void;
};

export default function SubjectTutorWizard({ subjectId, subjectName, schoolId, isDark, onDone }: Props) {
  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from('tutors').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }),
      supabase.from('subject_tutors').select('tutor_id').eq('school_id', schoolId).eq('subject_id', subjectId),
    ]).then(([tutorsRes, linksRes]) => {
      if (cancelled) return;
      if (tutorsRes.error) { setError('Αποτυχία φόρτωσης καθηγητών.'); setLoading(false); return; }
      setTutors(tutorsRes.data ?? []);
      setSelectedIds(new Set((linksRes.data ?? []).map((row: { tutor_id: string }) => row.tutor_id)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId, subjectId]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);

    const { data: linksRes, error: linksErr } = await supabase
      .from('subject_tutors')
      .select('tutor_id')
      .eq('school_id', schoolId)
      .eq('subject_id', subjectId);

    if (linksErr) {
      console.error(linksErr);
      setError('Αποτυχία ενημέρωσης καθηγητών.');
      setSaving(false);
      return;
    }

    const currentIds = new Set((linksRes ?? []).map((row: { tutor_id: string }) => row.tutor_id));
    const toAdd = [...selectedIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !selectedIds.has(id));

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from('subject_tutors')
        .upsert(toAdd.map((tutorId) => ({ school_id: schoolId, subject_id: subjectId, tutor_id: tutorId })), {
          onConflict: 'school_id,subject_id,tutor_id',
        });
      if (addErr) { console.error(addErr); setError('Αποτυχία ενημέρωσης καθηγητών.'); setSaving(false); return; }
    }

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('subject_tutors')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', subjectId)
        .in('tutor_id', toRemove);
      if (delErr) { console.error(delErr); setError('Αποτυχία ενημέρωσης καθηγητών.'); setSaving(false); return; }
    }

    const assignedNames = tutors.filter((t) => selectedIds.has(t.id)).map((t) => t.full_name);
    onDone(assignedNames);
  };

  const chipBase = `rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
    isDark
      ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-[#7C3AED]/50'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#7C3AED]/50'
  }`;
  const chipSelected = 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#7C3AED]';

  return (
    <div className={`max-w-[85%] space-y-2 rounded-xl border px-3 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
        Μάθημα: <span className="font-semibold">{subjectName}</span>
      </p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Επίλεξε καθηγητές:</p>
      <div className="flex flex-wrap gap-1.5">
        {tutors.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={saving}
            onClick={() => toggle(t.id)}
            className={`${chipBase} ${selectedIds.has(t.id) ? chipSelected : ''}`}
          >
            {t.full_name}
          </button>
        ))}
        {!loading && tutors.length === 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένοι καθηγητές.</p>
        )}
      </div>
      {tutors.length > 0 && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || loading}
          className="mt-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}
        >
          {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
        </button>
      )}
      {loading && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
