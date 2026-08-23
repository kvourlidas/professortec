// src/components/ui/ModalField.tsx
// Shared login-page-styled field primitives for modal forms across the app.
// Reference implementation: src/components/students/StudentCreateModal.tsx
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

export function modalInputCls(isDark: boolean): string {
  return `h-11 w-full border-b bg-transparent pl-7 pr-2 text-sm outline-none transition-colors duration-200 ${
    isDark
      ? 'border-white/15 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]'
      : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
  }`;
}

export function modalSelectCls(isDark: boolean): string {
  return `${modalInputCls(isDark)} appearance-none pr-7`;
}

export function ModalFormField({ label, hint, children, isDark }: {
  label: string; hint?: string; children: ReactNode; isDark: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className={`block text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>
        {label}
      </label>
      <div className="relative">{children}</div>
      {hint && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
}

export function ModalFieldIcon({ icon: Icon, isDark }: { icon: ElementType; isDark: boolean }) {
  return <Icon className={`pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />;
}

export function ModalSelectChevron({ isDark }: { isDark: boolean }) {
  return <ChevronDown className={`pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />;
}

export function ModalToggleEyeBtn({ show, toggle, isDark }: { show: boolean; toggle: () => void; isDark: boolean }) {
  return (
    <button type="button" onClick={toggle}
      className={`absolute right-0 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
      {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

export function ModalErrorBox({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return (
    <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-600'}`}>
      {children}
    </div>
  );
}
