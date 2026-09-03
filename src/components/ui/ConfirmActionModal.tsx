import React from 'react';
import { Loader2, Ban, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'red' | 'amber';
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = 'Επιβεβαίωση',
  cancelLabel = 'Ακύρωση',
  confirmColor = 'amber',
  busy = false,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEscapeToClose(open, onClose);

  if (!open) return null;

  const isRed = confirmColor === 'red';
  const Icon = isRed ? Ban : AlertTriangle;

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  const confirmBtnCls = isRed
    ? 'btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60'
    : 'btn bg-amber-500 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-amber-400 active:scale-[0.97] disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className={`mb-1 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${isRed ? 'bg-red-500/15 ring-red-500/30' : 'bg-amber-500/15 ring-amber-500/30'}`}>
            <Icon className={`h-5 w-5 ${isRed ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>{title}</h3>
        </div>

        <div className="p-6">
          <div className="text-xs leading-relaxed">{message}</div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={busy} className={cancelBtnCls}>
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} disabled={busy} className={confirmBtnCls}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {confirmLabel}…
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
