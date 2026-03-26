import { X, Receipt, Loader2 } from 'lucide-react';
import AppDatePicker from '../../ui/AppDatePicker';
import { clampNumber } from '../utils';
import type { ExtraExpenseRow } from '../types';

interface EconomicsEditExpenseModalProps {
  open: boolean;
  editing: ExtraExpenseRow | null;
  editName: string;
  onEditNameChange: (v: string) => void;
  editAmount: number;
  onEditAmountChange: (v: number) => void;
  editDate: string;
  onEditDateChange: (v: string) => void;
  editNotes: string;
  onEditNotesChange: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  isDark: boolean;
}

export function EconomicsEditExpenseModal({
  open, editing, editName, onEditNameChange, editAmount, onEditAmountChange,
  editDate, onEditDateChange, editNotes, onEditNotesChange,
  busy, onClose, onSave, isDark,
}: EconomicsEditExpenseModalProps) {
  if (!open || !editing) return null;

  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:opacity-50'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50';

  const labelCls = `mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl ${isDark ? 'border border-slate-700/60' : 'border border-slate-200 bg-white'}`}
        style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}/>
        <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${!isDark ? 'border-b border-slate-100' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <Receipt className="h-4 w-4" style={{ color: 'var(--color-accent)' }}/>
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Επεξεργασία Εξόδου</h3>
              <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ενημέρωση ονόματος / ποσού / ημερομηνίας / σημειώσεων.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className={modalCloseBtnCls}>
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 pb-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className={labelCls}>Όνομα εξόδου</div>
            <input value={editName} onChange={e => onEditNameChange(e.target.value)} className={inputCls} disabled={busy}/>
          </div>
          <div>
            <div className={labelCls}>Ποσό</div>
            <input value={editAmount} onChange={e => onEditAmountChange(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" disabled={busy}/>
          </div>
          <div>
            <div className={labelCls}>Ημερομηνία</div>
            <AppDatePicker value={editDate as never} onChange={(v: never) => onEditDateChange(v)}/>
          </div>
          <div className="md:col-span-2">
            <div className={labelCls}>Σημειώσεις</div>
            <input value={editNotes} onChange={e => onEditNotesChange(e.target.value)} className={inputCls} disabled={busy}/>
          </div>
        </div>

        <div className={modalFooterCls}>
          <button type="button" onClick={onClose} disabled={busy} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={onSave} disabled={busy || !editName.trim() || (Number(editAmount)||0) <= 0}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {busy ? <><Loader2 className="h-3 w-3 animate-spin"/>Αποθήκευση…</> : 'Αποθήκευση'}
          </button>
        </div>
      </div>
    </div>
  );
}
