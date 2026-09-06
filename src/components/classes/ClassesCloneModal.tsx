import { useEffect, useState } from 'react';
import { CopyPlus, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import StyledSelect from '../ui/StyledSelect';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { normalizeText } from './utils';
import type { ClassRow } from './types';

type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string };

interface ClassesCloneModalProps {
  open: boolean;
  schoolId: string | null;
  schoolYears: SchoolYearOption[];
  /** The school year new copies will be created into — i.e. whichever year is selected on the page. */
  targetYearId: string;
  existingClasses: ClassRow[];
  isDark: boolean;
  onClose: () => void;
  onCloned: (created: ClassRow[]) => void;
}

type PreviewClass = { id: string; title: string; subject: string | null; subject_id: string | null; exists: boolean };

export default function ClassesCloneModal({ open, schoolId, schoolYears, targetYearId, existingClasses, isDark, onClose, onCloned }: ClassesCloneModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [preview, setPreview] = useState<PreviewClass[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectCls = `h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'} disabled:opacity-50`;

  const sourceOptions = schoolYears.filter((y) => y.id !== targetYearId);

  const handleClose = () => {
    if (cloning) return;
    setError(null); setSourceId(''); setPreview(null);
    onClose();
  };

  useEscapeToClose(open, handleClose);

  useEffect(() => {
    if (!open) return;
    setSourceId(''); setPreview(null); setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !schoolId || !sourceId) { setPreview(null); return; }
    let ignore = false;

    const loadPreview = async () => {
      setLoadingPreview(true); setError(null);
      try {
        const { data: classRows, error: classErr } = await supabase
          .from('classes')
          .select('id, title, subject, subject_id')
          .eq('school_id', schoolId)
          .eq('school_year_id', sourceId);
        if (classErr) throw classErr;

        const existingTitles = new Set(existingClasses.map((c) => normalizeText(c.title)));
        const rows: PreviewClass[] = ((classRows ?? []) as any[])
          .map((c) => ({ id: c.id, title: c.title, subject: c.subject, subject_id: c.subject_id, exists: existingTitles.has(normalizeText(c.title)) }))
          .sort((a, b) => a.title.localeCompare(b.title, 'el'));

        if (!ignore) setPreview(rows);
      } catch (err: any) {
        if (!ignore) setError(err?.message ?? 'Αποτυχία φόρτωσης τμημάτων.');
      } finally {
        if (!ignore) setLoadingPreview(false);
      }
    };

    loadPreview();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolId, sourceId]);

  if (!open) return null;

  const toCreate = (preview ?? []).filter((c) => !c.exists);

  const confirmClone = async () => {
    if (toCreate.length === 0 || !targetYearId) return;
    setCloning(true); setError(null);
    try {
      const created: ClassRow[] = [];
      for (const c of toCreate) {
        const { data, error: fnErr } = await supabase.functions.invoke('classes-create', {
          body: { title: c.title, subject: c.subject, subject_id: c.subject_id, school_year_id: targetYearId },
        });
        if (fnErr || !data?.item) throw new Error(fnErr?.message ?? 'Αποτυχία δημιουργίας τμήματος.');
        created.push(data.item as ClassRow);
      }
      onCloned(created);
      handleClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αντιγραφής.');
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`} style={{ background: 'var(--color-sidebar)' }}>
        <div className="flex items-center justify-between rounded-t-2xl px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CopyPlus className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Αντιγραφή από άλλο έτος</h2>
          </div>
          <button type="button" onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Δημιουργεί νέα τμήματα με τα ίδια στοιχεία (όνομα, μάθημα) με τα τμήματα ενός άλλου σχολικού έτους, χωρίς μαθητές.
          </p>

          <div>
            <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>Από σχολικό έτος</label>
            <StyledSelect isDark={isDark} showChevron expanded value={sourceId} onChange={setSourceId} className={selectCls}
              options={[{ value: '', label: 'Επιλέξτε έτος' }, ...sourceOptions.map((y) => ({ value: y.id, label: y.name }))]} />
          </div>

          {loadingPreview && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Φόρτωση τμημάτων...
            </div>
          )}

          {!loadingPreview && preview !== null && (
            preview.length === 0 ? (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν τμήματα σε αυτό το σχολικό έτος.</p>
            ) : (
              <div className={`max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                {preview.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{c.title}</span>
                    {c.exists && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500'}`}>
                        υπάρχει ήδη
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-red-400"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>
          )}
        </div>

        <div className={`flex justify-end gap-2.5 rounded-b-2xl border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
          <button type="button" onClick={handleClose} disabled={cloning} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={confirmClone} disabled={cloning || loadingPreview || toCreate.length === 0}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {cloning ? <><Loader2 className="h-3 w-3 animate-spin" />Αντιγραφή…</> : `Αντιγραφή${toCreate.length > 0 ? ` (${toCreate.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
