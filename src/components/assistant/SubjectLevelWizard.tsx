import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';
import type { LevelRow, SubjectRow } from '../classes/types.ts';

type Props =
  | { mode: 'create'; name: string; schoolId: string; isDark: boolean; onDone: (result: SubjectRow | null) => void }
  | { mode: 'update'; subjectId: string; name: string; schoolId: string; isDark: boolean; onDone: (result: SubjectRow | null) => void };

export default function SubjectLevelWizard(props: Props) {
  const { name, schoolId, isDark, onDone } = props;
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

  const handlePick = async (levelId: string) => {
    setSaving(true);
    setError(null);

    const endpoint = props.mode === 'create' ? 'subjects-create' : 'subjects-update';
    const body = props.mode === 'create' ? { name, level_id: levelId } : { subject_id: props.subjectId, name, level_id: levelId };

    const { data, error: fnError } = await supabase.functions.invoke(endpoint, { body });

    if (fnError || !data?.item) {
      console.error(fnError ?? data);
      setError(props.mode === 'create' ? 'Αποτυχία δημιουργίας μαθήματος.' : 'Αποτυχία ενημέρωσης μαθήματος.');
      setSaving(false);
      return;
    }

    onDone(data.item as SubjectRow);
  };

  const chipBase = `rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
    isDark
      ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-[#7C3AED]/50'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#7C3AED]/50'
  }`;

  return (
    <div className={`max-w-[85%] space-y-2 rounded-xl border px-3 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
        Μάθημα: <span className="font-semibold">{name}</span>
      </p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Επίλεξε επίπεδο:</p>
      <div className="flex flex-wrap gap-1.5">
        {levels.map((lvl) => (
          <button key={lvl.id} type="button" disabled={saving} onClick={() => handlePick(lvl.id)} className={chipBase}>
            {lvl.name}
          </button>
        ))}
      </div>
      {!loading && levels.length === 0 && (
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένα επίπεδα. Δημιούργησε πρώτα ένα επίπεδο.</p>
      )}
      {loading && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση...</p>}
      {saving && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{props.mode === 'create' ? 'Δημιουργία...' : 'Ενημέρωση...'}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
