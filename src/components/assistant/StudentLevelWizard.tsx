import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';
import type { LevelRow } from '../classes/types.ts';

export type PendingStudent = {
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  special_notes: string | null;
  father_name: string | null;
  father_date_of_birth: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_date_of_birth: string | null;
  mother_phone: string | null;
  mother_email: string | null;
};

export type PendingStudentUpdate = PendingStudent & {
  student_id: string;
  level_id: string | null;
};

export type CreatedStudent = { id: string; full_name: string };

type Props =
  | { mode: 'create'; student: PendingStudent; schoolId: string; isDark: boolean; onDone: (result: CreatedStudent | null) => void }
  | { mode: 'update'; student: PendingStudentUpdate; schoolId: string; isDark: boolean; onDone: (result: CreatedStudent | null) => void };

export default function StudentLevelWizard({ mode, student, schoolId, isDark, onDone }: Props) {
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('levels')
      .select('id, school_id, name')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) { setError('Αποτυχία φόρτωσης επιπέδων.'); setLoading(false); return; }
        setLevels(data ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [schoolId]);

  const handlePick = async (levelId: string | null) => {
    setSaving(true);
    setError(null);

    const endpoint = mode === 'create' ? 'student-create' : 'student-update';
    const { data, error: fnError } = await supabase.functions.invoke(endpoint, {
      body: { ...student, level_id: levelId },
    });

    if (fnError || !data?.item) {
      console.error(fnError ?? data);
      setError(mode === 'create' ? 'Αποτυχία δημιουργίας μαθητή.' : 'Αποτυχία ενημέρωσης μαθητή.');
      setSaving(false);
      return;
    }

    onDone(data.item as CreatedStudent);
  };

  const chipBase = `rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
    isDark
      ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-[#7C3AED]/50'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#7C3AED]/50'
  }`;

  return (
    <div className={`max-w-[85%] space-y-2 rounded-xl border px-3 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
        Μαθητής: <span className="font-semibold">{student.full_name}</span>
      </p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Επίλεξε επίπεδο:</p>
      <div className="flex flex-wrap gap-1.5">
        {levels.map((lvl) => (
          <button key={lvl.id} type="button" disabled={saving} onClick={() => handlePick(lvl.id)} className={chipBase}>
            {lvl.name}
          </button>
        ))}
        <button type="button" disabled={saving} onClick={() => handlePick(null)} className={chipBase}>
          Χωρίς επίπεδο
        </button>
      </div>
      {!loading && levels.length === 0 && (
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένα επίπεδα.</p>
      )}
      {loading && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση...</p>}
      {saving && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mode === 'create' ? 'Δημιουργία...' : 'Ενημέρωση...'}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
