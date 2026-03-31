// src/components/tutors/TutorColumnFilterDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { Columns2, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { triggerCls } from '../students/dropdownTriggerCls';

export type TutorColumnKey = 'full_name' | 'date_of_birth' | 'afm' | 'phone' | 'email' | 'iban' | 'notes';

export type TutorColumnDef = {
  key: TutorColumnKey;
  label: string;
  alwaysVisible?: boolean;
};

export const ALL_TUTOR_COLUMNS: TutorColumnDef[] = [
  { key: 'full_name',     label: 'Ονοματεπώνυμο', alwaysVisible: true },
  { key: 'date_of_birth', label: 'Ημ. Γέννησης'  },
  { key: 'afm',           label: 'ΑΦΜ'            },
  { key: 'phone',         label: 'Τηλέφωνο'       },
  { key: 'email',         label: 'Email'           },
  { key: 'iban',          label: 'IBAN'            },
  { key: 'notes',         label: 'Σημειώσεις'     },
];

export const DEFAULT_TUTOR_VISIBLE = new Set<TutorColumnKey>([
  'full_name', 'date_of_birth', 'afm', 'phone', 'email',
]);

type Props = {
  visible: Set<TutorColumnKey>;
  onChange: (next: Set<TutorColumnKey>) => void;
  isDark: boolean;
};

export default function TutorColumnFilterDropdown({ visible, onChange, isDark }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (key: TutorColumnKey, alwaysVisible?: boolean) => {
    if (alwaysVisible) return;
    const next = new Set(visible);
    if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key);
    onChange(next);
  };

  const isDefault =
    visible.size === DEFAULT_TUTOR_VISIBLE.size &&
    [...DEFAULT_TUTOR_VISIBLE].every(k => visible.has(k));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={triggerCls(open, isDark)}>
        <Columns2 className="h-3 w-3 shrink-0 opacity-60" />
        <span>Στήλες</span>
        <span
          className="inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-sm px-0.5 text-[9px] font-bold tabular-nums"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}
        >
          {visible.size}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-2xl border shadow-2xl
            ${isDark ? 'border-white/10 bg-slate-900/90 shadow-black/60' : 'border-slate-200/80 bg-white/90 shadow-slate-300/50'}`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Ορατές στήλες</span>
            <button
              type="button"
              onClick={() => onChange(new Set(DEFAULT_TUTOR_VISIBLE))}
              disabled={isDefault}
              className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-all
                disabled:opacity-25 disabled:cursor-not-allowed
                ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Επαναφορά
            </button>
          </div>

          {/* Column list */}
          {ALL_TUTOR_COLUMNS.map((col: TutorColumnDef) => {
            const checked = visible.has(col.key);
            const locked = !!col.alwaysVisible;
            return (
              <button
                key={col.key}
                type="button"
                disabled={locked}
                onClick={() => toggle(col.key, col.alwaysVisible)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-[7px] text-[11px] transition-colors duration-100
                  ${locked ? 'cursor-default opacity-35' : isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-all
                    ${checked ? 'border-transparent' : isDark ? 'border-slate-600' : 'border-slate-300'}`}
                  style={checked ? { background: 'var(--color-accent)' } : undefined}
                >
                  {checked && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                </span>
                <span className={`flex-1 text-left leading-none ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{col.label}</span>
                {locked && <span className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>πάντα</span>}
              </button>
            );
          })}

          {/* Footer */}
          <div className={`px-3.5 py-2 border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              {visible.size} / {ALL_TUTOR_COLUMNS.length} ενεργές
            </span>
          </div>
        </div>
      )}
    </div>
  );
}