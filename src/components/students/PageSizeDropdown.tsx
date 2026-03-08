// src/components/students/PageSizeDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { Rows3, Check, ChevronDown } from 'lucide-react';
import { triggerCls } from './dropdownTriggerCls';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSizeOption = typeof PAGE_SIZE_OPTIONS[number];

type Props = {
  value: PageSizeOption;
  onChange: (v: PageSizeOption) => void;
  isDark: boolean;
};

export default function PageSizeDropdown({ value, onChange, isDark }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls(open, isDark)}>
        <Rows3 className="h-3 w-3 shrink-0 opacity-60" />
        <span>{value} / σελίδα</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-xl border shadow-2xl
            ${isDark ? 'border-white/10 bg-slate-900/90 shadow-black/60' : 'border-slate-200/80 bg-white/90 shadow-slate-300/50'}`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          <div className={`px-3 py-2 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Εγγραφές / σελίδα
            </span>
          </div>
          {PAGE_SIZE_OPTIONS.map((opt) => {
            const active = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-2 text-[11px] transition-colors duration-100
                  ${active
                    ? isDark ? 'bg-white/[0.06] text-white' : 'bg-slate-50 text-slate-900'
                    : isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="font-medium">{opt}</span>
                {active && (
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px]"
                    style={{ background: 'var(--color-accent)' }}
                  >
                    <Check className="h-2 w-2 text-white" strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}