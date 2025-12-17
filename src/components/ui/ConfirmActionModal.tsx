import React from 'react';
import { Loader2 } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <h3 className="mb-2 text-sm font-semibold text-slate-50">{title}</h3>

        <div className="mb-4 text-xs leading-relaxed text-slate-200">{message}</div>

        <div className="flex justify-end gap-2 text-xs">
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost px-3 py-1 disabled:opacity-60"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text-main)',
            }}
          >
            {cancelLabel}
          </button>

          {/* Confirm */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-60"
            style={{
              backgroundColor: confirmColor === 'red' ? '#dc2626' : 'var(--color-accent)',
              color: confirmColor === 'red' ? '#fff' : '#000',
            }}
          >
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
  );
}
