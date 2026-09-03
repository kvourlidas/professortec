import { X, Receipt, Loader2, Euro, FileText } from 'lucide-react';
import AppDatePicker from '../../ui/AppDatePicker';
import { ModalFormField, ModalFieldIcon, modalInputCls } from '../../ui/ModalField';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
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
  useEscapeToClose(open && !!editing, onClose);

  if (!open || !editing) return null;

  const inputCls = modalInputCls(isDark);
  const inputClsNoIcon = inputCls.replace('pl-7', 'pl-3');

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl ${isDark ? 'border border-slate-700/60' : 'border border-slate-200 bg-white'}`}
        style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <Receipt className="h-4 w-4" style={{ color: 'var(--ch-icon)' }}/>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Επεξεργασία Εξόδου</h3>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>Ενημέρωση ονόματος / ποσού / ημερομηνίας / σημειώσεων.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-50"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 pb-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <ModalFormField label="Όνομα εξόδου" isDark={isDark}>
              <ModalFieldIcon icon={FileText} isDark={isDark} />
              <input value={editName} onChange={e => onEditNameChange(e.target.value)} className={inputCls} disabled={busy}/>
            </ModalFormField>
          </div>
          <div>
            <ModalFormField label="Ποσό" isDark={isDark}>
              <ModalFieldIcon icon={Euro} isDark={isDark} />
              <input value={editAmount} onChange={e => onEditAmountChange(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" disabled={busy}/>
            </ModalFormField>
          </div>
          <div>
            <ModalFormField label="Ημερομηνία" isDark={isDark}>
              <AppDatePicker label="" value={editDate} onChange={onEditDateChange} variant="underline"/>
            </ModalFormField>
          </div>
          <div className="md:col-span-2">
            <ModalFormField label="Σημειώσεις" isDark={isDark}>
              <input value={editNotes} onChange={e => onEditNotesChange(e.target.value)} className={inputClsNoIcon} disabled={busy}/>
            </ModalFormField>
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
