import React, { useState, useEffect } from 'react';
import { Banknote, CreditCard, HandCoins, Landmark, Loader2, X } from 'lucide-react';
import type { PaymentMethod, StudentViewRow } from './types';

interface Props {
  row: StudentViewRow | null;
  paymentInput: string;
  payingLoading: boolean;
  note: string;
  isDark: boolean;
  onInputChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSubmit: (method: PaymentMethod) => void;
  onClose: () => void;
}

export function PaymentModal({
  row, paymentInput, payingLoading, note, isDark,
  onInputChange, onNoteChange, onSubmit, onClose,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  useEffect(() => { setMethod('cash'); }, [row?.sub.id]);

  if (!row) return null;

  const inputCls = `h-9 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!payingLoading) onClose(); }} />
      <div className={`relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ background: 'var(--ch-bg)', borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <HandCoins className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ch-text)' }}>Νέα Πληρωμή</div>
              <div className="text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>{row.student_name}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={payingLoading}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-5">
          <input type="text" inputMode="decimal" placeholder="Ποσό"
            className={inputCls} value={paymentInput}
            onChange={e => onInputChange(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
            disabled={payingLoading} autoFocus />

          <div className="flex gap-2">
            {([
              { m: 'cash',          Icon: Banknote,   label: 'Μετρητά'  },
              { m: 'card',          Icon: CreditCard,  label: 'Κάρτα'   },
              { m: 'bank_transfer', Icon: Landmark,    label: 'Τράπεζα' },
            ] as { m: PaymentMethod; Icon: React.ElementType; label: string }[]).map(({ m, Icon, label }) => (
              <button key={m} type="button" disabled={payingLoading}
                onClick={() => setMethod(m)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition disabled:opacity-50 ${
                  method === m
                    ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]'
                    : isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-white text-slate-500'
                }`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <input type="text" placeholder="Σημείωση (προαιρετικό)"
            className={inputCls} value={note}
            onChange={e => onNoteChange(e.target.value)}
            disabled={payingLoading} />
        </div>

        {/* Footer */}
        <div className={`flex gap-2 border-t px-5 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`}>
          <button type="button" disabled={payingLoading} onClick={onClose}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            Άκυρο
          </button>
          <button type="button" onClick={() => onSubmit(method)} disabled={payingLoading}
            className="flex flex-1 items-center justify-center gap-1.5 btn-primary px-3 py-2 text-xs font-semibold disabled:opacity-60">
            {payingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
            Καταχώρηση
          </button>
        </div>
      </div>
    </div>
  );
}
