import { Plus, Loader2, Receipt } from 'lucide-react';
import AppDatePicker from '../../ui/AppDatePicker';
import { clampNumber } from '../utils';

interface EconomicsExtraExpenseFormProps {
  expName: string;
  onExpNameChange: (v: string) => void;
  expAmount: number;
  onExpAmountChange: (v: number) => void;
  expDate: string;
  onExpDateChange: (v: string) => void;
  expNotes: string;
  onExpNotesChange: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
  isDark: boolean;
}

export function EconomicsExtraExpenseForm({
  expName, onExpNameChange, expAmount, onExpAmountChange,
  expDate, onExpDateChange, expNotes, onExpNotesChange,
  busy, onSubmit, isDark,
}: EconomicsExtraExpenseFormProps) {
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const addExpenseBtnCls = isDark
    ? 'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40'
    : 'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-40';

  const labelCls = `mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div>
      <div className={`flex items-center gap-2.5 pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
          <Receipt className="h-3.5 w-3.5" style={{ color: 'var(--ch-icon)' }}/>
        </div>
        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Extra Έξοδα</span>
      </div>
      <div className="space-y-3 pt-3">
        <div>
          <div className={labelCls}>Όνομα εξόδου</div>
          <input value={expName} onChange={e => onExpNameChange(e.target.value)} className={inputCls} placeholder="π.χ. Ενοίκιο / ΔΕΗ / Internet" disabled={busy}/>
        </div>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <div className={labelCls}>Ποσό</div>
            <input value={expAmount} onChange={e => onExpAmountChange(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" disabled={busy}/>
          </div>
          <div className="col-span-7">
            <div className={labelCls}>Ημερομηνία</div>
            <AppDatePicker value={expDate} onChange={onExpDateChange}/>
          </div>
        </div>
        <div>
          <div className={labelCls}>Σημειώσεις</div>
          <input value={expNotes} onChange={e => onExpNotesChange(e.target.value)} className={inputCls} placeholder="προαιρετικό" disabled={busy}/>
        </div>
        <button type="button" onClick={onSubmit} disabled={busy || !expName.trim() || (Number(expAmount)||0) <= 0} className={addExpenseBtnCls}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Plus className="h-3.5 w-3.5"/>}
          Προσθήκη
        </button>
      </div>
    </div>
  );
}
