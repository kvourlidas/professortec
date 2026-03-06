import { Plus, Loader2, Receipt } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import { clampNumber } from './utils';

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
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const addExpenseBtnCls = isDark
    ? 'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40'
    : 'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-40';

  const labelCls = `mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div className={cardCls}>
      <div className={`flex items-center gap-2.5 px-4 py-3 ${isDark ? 'border-b border-slate-800/70 bg-slate-900/30' : 'border-b border-slate-200 bg-slate-50'}`}>
        <Receipt className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }}/>
        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Extra Έξοδα</span>
      </div>
      <div className="space-y-3 p-4">
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
            <AppDatePicker value={expDate as never} onChange={(v: never) => onExpDateChange(v)}/>
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
