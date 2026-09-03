import { useState } from 'react';
import { HandCoins, X, Loader2, Banknote, CreditCard, Landmark, Euro, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon,
  ModalErrorBox, modalInputCls,
} from '../ui/ModalField';

interface PrivateLessonPaymentModalProps {
  studentName: string;
  balance: number;
  onSubmit: (amount: number, method: 'cash' | 'card' | 'bank_transfer', note: string) => Promise<void>;
  onClose: () => void;
}

const METHODS: { key: 'cash' | 'card' | 'bank_transfer'; label: string; icon: React.ReactNode }[] = [
  { key: 'cash', label: 'Μετρητά', icon: <Banknote className="h-3.5 w-3.5" /> },
  { key: 'card', label: 'Κάρτα', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'bank_transfer', label: 'Τράπεζα', icon: <Landmark className="h-3.5 w-3.5" /> },
];

export function PrivateLessonPaymentModal({ studentName, balance, onSubmit, onClose }: PrivateLessonPaymentModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [method, setMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(true, onClose);

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = async () => {
    if (!isValid) { setError('Εισάγετε έγκυρο ποσό.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(parsedAmount, method, note.trim());
    } catch {
      setError('Αποτυχία καταχώρησης πληρωμής.');
      setSaving(false);
    }
  };

  const inputCls = modalInputCls(isDark);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? 'border-slate-700/60' : 'border-slate-200'
      }`} style={{ background: 'var(--color-sidebar)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <HandCoins className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Καταχώρηση Πληρωμής</p>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{studentName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        <div className="px-6 py-5 space-y-4">
          {/* Balance info */}
          {balance > 0 && (
            <div className={`rounded-xl border px-3 py-2.5 ${isDark ? 'border-rose-800/40 bg-rose-950/30' : 'border-rose-200 bg-rose-50'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>Υπόλοιπο</p>
              <p className={`text-lg font-bold tabular-nums ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>{balance.toFixed(2)}€</p>
            </div>
          )}

          {/* Amount */}
          <FormField label="Ποσό (€)" isDark={isDark}>
            <FieldIcon icon={Euro} isDark={isDark} />
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputCls}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </FormField>

          {/* Method */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Τρόπος Πληρωμής
            </label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 px-2 text-[11px] font-medium transition ${
                    method === m.key
                      ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                      : isDark
                        ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <FormField label="Σημείωση (προαιρετικό)" isDark={isDark}>
            <input
              type="text"
              className={`${inputCls} pl-3`}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="π.χ. Μαρτίου μηνιαίο"
              maxLength={200}
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
          <button type="button" onClick={onClose} disabled={saving}
            className={`btn border px-4 py-1.5 text-sm disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            Ακύρωση
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !isValid}
            className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποθήκευση…</> : <><HandCoins className="h-3.5 w-3.5" />Καταχώρηση</>}
          </button>
        </div>
      </div>
    </div>
  );
}
