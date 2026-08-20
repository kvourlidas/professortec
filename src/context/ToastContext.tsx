import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTheme } from './ThemeContext';

type ToastVariant = 'success' | 'error';
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 1500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <ToastPill key={t.id} message={t.message} variant={t.variant} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastPill({ message, variant }: { message: string; variant: ToastVariant }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isError = variant === 'error';

  return (
    <div
      className={`animate-toast-in flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur-md ${
        isError
          ? isDark ? 'border-red-500/40 bg-red-950/90 text-red-200' : 'border-red-200 bg-white text-red-600'
          : isDark ? 'border-emerald-500/40 bg-slate-900/90 text-emerald-300' : 'border-emerald-200 bg-white text-emerald-700'
      }`}
    >
      {isError ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
