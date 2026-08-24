import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';

type SpecialtyOption = { id: string; name: string };

type Props = {
  tutorId: string;
  tutorName: string;
  schoolId: string;
  isDark: boolean;
  onDone: (assignedNames: string[] | null) => void;
};

export default function TutorSpecialtyWizard({ tutorId, tutorName, schoolId, isDark, onDone }: Props) {
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from('specialties').select('id, name').eq('school_id', schoolId).order('name', { ascending: true }),
      supabase.from('tutor_specialties').select('specialty_id').eq('school_id', schoolId).eq('tutor_id', tutorId),
    ]).then(([specialtiesRes, linksRes]) => {
      if (cancelled) return;
      if (specialtiesRes.error) { setError('Αποτυχία φόρτωσης ειδικοτήτων.'); setLoading(false); return; }
      setSpecialties(specialtiesRes.data ?? []);
      setSelectedIds(new Set((linksRes.data ?? []).map((row: { specialty_id: string }) => row.specialty_id)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [schoolId, tutorId]);

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
      .from('tutor_specialties')
      .select('specialty_id')
      .eq('school_id', schoolId)
      .eq('tutor_id', tutorId);

    if (linksErr) {
      console.error(linksErr);
      setError('Αποτυχία ενημέρωσης ειδικοτήτων.');
      setSaving(false);
      return;
    }

    const currentIds = new Set((linksRes ?? []).map((row: { specialty_id: string }) => row.specialty_id));
    const toAdd = [...selectedIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !selectedIds.has(id));

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from('tutor_specialties')
        .upsert(toAdd.map((specialtyId) => ({ school_id: schoolId, tutor_id: tutorId, specialty_id: specialtyId })), {
          onConflict: 'tutor_id,specialty_id',
        });
      if (addErr) { console.error(addErr); setError('Αποτυχία ενημέρωσης ειδικοτήτων.'); setSaving(false); return; }
    }

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('tutor_specialties')
        .delete()
        .eq('tutor_id', tutorId)
        .in('specialty_id', toRemove);
      if (delErr) { console.error(delErr); setError('Αποτυχία ενημέρωσης ειδικοτήτων.'); setSaving(false); return; }
    }

    const assignedNames = specialties.filter((s) => selectedIds.has(s.id)).map((s) => s.name);
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
        Καθηγητής: <span className="font-semibold">{tutorName}</span>
      </p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Επίλεξε ειδικότητες:</p>
      <div className="flex flex-wrap gap-1.5">
        {specialties.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={saving}
            onClick={() => toggle(s.id)}
            className={`${chipBase} ${selectedIds.has(s.id) ? chipSelected : ''}`}
          >
            {s.name}
          </button>
        ))}
        {!loading && specialties.length === 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένες ειδικότητες.</p>
        )}
      </div>
      {specialties.length > 0 && (
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
