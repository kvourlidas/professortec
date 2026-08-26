import { useState } from 'react';
import { CopyPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import StyledSelect from '../ui/StyledSelect';

type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string; is_summer: boolean };

interface ProgramCloneModalProps {
  open: boolean;
  schoolId: string | null;
  schoolYears: SchoolYearOption[];
  isDark: boolean;
  onClose: () => void;
  onCloned: () => void;
}

export default function ProgramCloneModal({ open, schoolId, schoolYears, isDark, onClose, onCloned }: ProgramCloneModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';
  const selectCls = `h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`;

  const source = schoolYears.find((y) => y.id === sourceId) ?? null;
  const target = schoolYears.find((y) => y.id === targetId) ?? null;

  const handleClose = () => { if (cloning) return; setError(null); setSourceId(''); setTargetId(''); onClose(); };

  const confirmClone = async () => {
    if (!schoolId || !source || !target || source.id === target.id) return;
    setCloning(true); setError(null);
    try {
      const { data: classRows } = await supabase.from('classes').select('id,is_active').eq('school_id', schoolId);
      const activeClassIds = new Set((classRows ?? []).filter((c: any) => c.is_active).map((c: any) => c.id));

      const { data: programRows } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(1);
      const programId = (programRows?.[0] as { id: string } | undefined)?.id ?? null;
      if (!programId) throw new Error('Δεν βρέθηκε πρόγραμμα.');

      const { data: itemRows } = await supabase.from('program_items').select('*').eq('program_id', programId);
      const overlapping = ((itemRows ?? []) as any[]).filter((it) => {
        if (!it.class_id || !activeClassIds.has(it.class_id)) return false;
        const s = it.start_date ?? '0001-01-01';
        const e = it.end_date ?? '9999-12-31';
        return s <= source.end_date && e >= source.start_date;
      });

      if (overlapping.length > 0) {
        const payload = overlapping.map((it) => ({
          program_id: programId,
          class_id: it.class_id,
          subject_id: it.subject_id,
          tutor_id: it.tutor_id,
          student_id: it.student_id,
          day_of_week: it.day_of_week,
          position: it.position,
          start_time: it.start_time,
          end_time: it.end_time,
          start_date: target.start_date,
          end_date: target.end_date,
          room: it.room,
          charge_per_session: it.charge_per_session,
        }));
        const { error: insErr } = await supabase.from('program_items').insert(payload);
        if (insErr) throw insErr;
      }

      onCloned();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αντιγραφής.');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`} style={{ background: 'var(--color-sidebar)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CopyPlus className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Αντιγραφή προγράμματος</h2>
          </div>
          <button type="button" onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Αντιγράφει τις ώρες προγράμματος των ενεργών τμημάτων από ένα σχολικό έτος σε ένα άλλο, προσαρμόζοντας τις ημερομηνίες στο νέο διάστημα.
          </p>

          <div>
            <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>Από</label>
            <StyledSelect isDark={isDark} showChevron value={sourceId} onChange={setSourceId} className={selectCls}
              options={[{ value: '', label: 'Επιλέξτε έτος' }, ...schoolYears.map((y) => ({ value: y.id, label: y.name }))]} />
          </div>
          <div>
            <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>Σε</label>
            <StyledSelect isDark={isDark} showChevron value={targetId} onChange={setTargetId} className={selectCls}
              options={[{ value: '', label: 'Επιλέξτε έτος' }, ...schoolYears.filter((y) => y.id !== sourceId).map((y) => ({ value: y.id, label: y.name }))]} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className={`flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
          <button type="button" onClick={handleClose} disabled={cloning} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={confirmClone} disabled={cloning || !sourceId || !targetId || sourceId === targetId}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {cloning ? <><Loader2 className="h-3 w-3 animate-spin" />Αντιγραφή…</> : 'Αντιγραφή'}
          </button>
        </div>
      </div>
    </div>
  );
}
