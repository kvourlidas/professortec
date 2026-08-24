import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';
import type { LevelRow, SubjectRow, ClassRow } from '../classes/types.ts';

type Props =
  | { mode: 'create'; title: string; schoolId: string; isDark: boolean; onDone: (result: ClassRow | null) => void }
  | { mode: 'update'; classId: string; title: string; schoolId: string; isDark: boolean; onDone: (result: ClassRow | null) => void };

type Step = 'level' | 'subject' | 'saving';

export default function ClassCreationWizard(props: Props) {
  const { title, schoolId, isDark, onDone } = props;
  const [step, setStep] = useState<Step>('level');
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LevelRow | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

  const handlePickLevel = async (level: LevelRow) => {
    setSelectedLevel(level);
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('subjects')
      .select('id, school_id, name, level_id')
      .eq('school_id', schoolId)
      .eq('level_id', level.id)
      .order('name', { ascending: true });
    setLoading(false);
    if (fetchError) { setError('Αποτυχία φόρτωσης μαθημάτων.'); return; }
    setSubjects(data ?? []);
    setStep('subject');
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setStep('saving');
    setError(null);
    const chosen = subjects.filter((s) => selectedSubjectIds.has(s.id));
    const subjectText = chosen.map((s) => s.name).join(', ') || null;
    const primarySubjectId = chosen[0]?.id ?? null;

    const endpoint = props.mode === 'create' ? 'classes-create' : 'classes-update';
    const body =
      props.mode === 'create'
        ? { title, subject: subjectText, subject_id: primarySubjectId }
        : { class_id: props.classId, title, subject: subjectText, subject_id: primarySubjectId };

    const { data, error: fnError } = await supabase.functions.invoke(endpoint, { body });

    if (fnError || !data?.item) {
      console.error(fnError ?? data);
      setError(props.mode === 'create' ? 'Αποτυχία δημιουργίας τμήματος.' : 'Αποτυχία ενημέρωσης τμήματος.');
      setStep('subject');
      return;
    }

    onDone(data.item as ClassRow);
  };

  const chipBase = `rounded-full border px-3 py-1.5 text-xs transition ${
    isDark
      ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-[#7C3AED]/50'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#7C3AED]/50'
  }`;
  const chipSelected = 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#7C3AED]';

  return (
    <div className={`max-w-[85%] space-y-2 rounded-xl border px-3 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
        Τμήμα: <span className="font-semibold">{title}</span>
      </p>

      {step === 'level' && (
        <>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Επίλεξε επίπεδο:</p>
          <div className="flex flex-wrap gap-1.5">
            {levels.map((lvl) => (
              <button key={lvl.id} type="button" onClick={() => handlePickLevel(lvl)} className={chipBase}>
                {lvl.name}
              </button>
            ))}
            {!loading && levels.length === 0 && (
              <p className="text-xs text-red-400">Δεν υπάρχουν καταχωρημένα επίπεδα.</p>
            )}
          </div>
        </>
      )}

      {(step === 'subject' || step === 'saving') && selectedLevel && (
        <>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Επίπεδο: <span className="font-medium">{selectedLevel.name}</span> — επίλεξε μάθημα(τα):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((subj) => (
              <button
                key={subj.id}
                type="button"
                onClick={() => toggleSubject(subj.id)}
                disabled={step === 'saving'}
                className={`${chipBase} ${selectedSubjectIds.has(subj.id) ? chipSelected : ''}`}
              >
                {subj.name}
              </button>
            ))}
            {!loading && subjects.length === 0 && (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα σε αυτό το επίπεδο.</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={step === 'saving'}
            className="mt-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}
          >
            {step === 'saving'
              ? (props.mode === 'create' ? 'Δημιουργία...' : 'Ενημέρωση...')
              : selectedSubjectIds.size === 0
                ? (props.mode === 'create' ? 'Δημιουργία χωρίς μάθημα' : 'Ενημέρωση χωρίς μάθημα')
                : (props.mode === 'create' ? 'Δημιουργία τμήματος' : 'Ενημέρωση τμήματος')}
          </button>
        </>
      )}

      {loading && step !== 'saving' && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
