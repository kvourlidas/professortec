// src/components/students/ColumnFilterDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { Columns2, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { triggerCls } from './dropdownTriggerCls';

export type ColumnKey =
  | 'full_name' | 'level' | 'date_of_birth' | 'phone' | 'email' | 'special_notes'
  | 'father_name' | 'father_date_of_birth' | 'father_phone' | 'father_email'
  | 'mother_name' | 'mother_date_of_birth' | 'mother_phone' | 'mother_email'
  | 'created_at';

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  group: 'Μαθητής' | 'Πατέρας' | 'Μητέρα' | 'Άλλα';
  alwaysVisible?: boolean;
};

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'full_name',             label: 'Ονοματεπώνυμο',   group: 'Μαθητής', alwaysVisible: true },
  { key: 'level',                 label: 'Επίπεδο',          group: 'Μαθητής' },
  { key: 'date_of_birth',         label: 'Ημ. Γέννησης',     group: 'Μαθητής' },
  { key: 'phone',                 label: 'Τηλέφωνο',         group: 'Μαθητής' },
  { key: 'email',                 label: 'Email',             group: 'Μαθητής' },
  { key: 'special_notes',         label: 'Σημειώσεις',       group: 'Μαθητής' },
  { key: 'father_name',           label: 'Όνομα Πατέρα',     group: 'Πατέρας' },
  { key: 'father_date_of_birth',  label: 'Ημ. Γέννησης',     group: 'Πατέρας' },
  { key: 'father_phone',          label: 'Τηλέφωνο',         group: 'Πατέρας' },
  { key: 'father_email',          label: 'Email',             group: 'Πατέρας' },
  { key: 'mother_name',           label: 'Όνομα Μητέρας',    group: 'Μητέρα' },
  { key: 'mother_date_of_birth',  label: 'Ημ. Γέννησης',     group: 'Μητέρα' },
  { key: 'mother_phone',          label: 'Τηλέφωνο',         group: 'Μητέρα' },
  { key: 'mother_email',          label: 'Email',             group: 'Μητέρα' },
  { key: 'created_at',            label: 'Ημ. Εγγραφής',     group: 'Άλλα' },
];

export const DEFAULT_VISIBLE: Set<ColumnKey> = new Set([
  'full_name', 'level', 'date_of_birth', 'phone', 'email', 'special_notes',
]);

const GROUPS: ColumnDef['group'][] = ['Μαθητής', 'Πατέρας', 'Μητέρα', 'Άλλα'];

const GROUP_META: Record<ColumnDef['group'], { dot: string; text: string }> = {
  'Μαθητής': { dot: 'bg-sky-400',    text: 'text-sky-400' },
  'Πατέρας': { dot: 'bg-violet-400', text: 'text-violet-400' },
  'Μητέρα':  { dot: 'bg-rose-400',   text: 'text-rose-400' },
  'Άλλα':    { dot: 'bg-amber-400',  text: 'text-amber-400' },
};

type Props = {
  visible: Set<ColumnKey>;
  onChange: (next: Set<ColumnKey>) => void;
  isDark: boolean;
};

export default function ColumnFilterDropdown({ visible, onChange, isDark }: Props) {
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

  const toggle = (key: ColumnKey, alwaysVisible?: boolean) => {
    if (alwaysVisible) return;
    const next = new Set(visible);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  const isDefault =
    visible.size === DEFAULT_VISIBLE.size &&
    [...DEFAULT_VISIBLE].every((k) => visible.has(k));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls(open, isDark)}>
        <Columns2 className="h-3 w-3 shrink-0 opacity-60" />
        <span>Στήλες</span>
        {/* Accent count chip */}
        <span
          className="inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-sm px-0.5 text-[9px] font-bold tabular-nums"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
            color: 'var(--color-accent)',
          }}
        >
          {visible.size}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <style>{`
            .col-filter-scroll::-webkit-scrollbar { width: 4px; }
            .col-filter-scroll::-webkit-scrollbar-track { background: transparent; }
            .col-filter-scroll::-webkit-scrollbar-thumb {
              border-radius: 99px;
              background: ${isDark ? 'rgba(100,116,139,0.35)' : 'rgba(148,163,184,0.4)'};
            }
            .col-filter-scroll::-webkit-scrollbar-thumb:hover {
              background: ${isDark ? 'rgba(100,116,139,0.6)' : 'rgba(100,116,139,0.45)'};
            }
          `}</style>
          <div
            className={`absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-2xl border shadow-2xl
              ${isDark ? 'border-white/10 bg-slate-900/90 shadow-black/60' : 'border-slate-200/80 bg-white/90 shadow-slate-300/50'}`}
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Ορατές στήλες</span>
              <button
                type="button"
                onClick={() => onChange(new Set(DEFAULT_VISIBLE))}
                disabled={isDefault}
                className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-all
                  disabled:opacity-25 disabled:cursor-not-allowed
                  ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Επαναφορά
              </button>
            </div>

            <div
              className="col-filter-scroll overflow-y-auto"
              style={{ maxHeight: '17rem', scrollbarWidth: 'thin', scrollbarColor: isDark ? '#475569 transparent' : '#cbd5e1 transparent' }}
            >
              {GROUPS.map((group, gi) => {
                const cols = ALL_COLUMNS.filter((c) => c.group === group);
                const meta = GROUP_META[group];
                return (
                  <div key={group}>
                    <div
                      className={`sticky top-0 z-10 flex items-center gap-1.5 px-3.5 py-1.5
                        ${gi > 0 ? `border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}` : ''}
                        ${isDark ? 'bg-slate-900/90' : 'bg-white/90'}`}
                      style={{ backdropFilter: 'blur(12px)' }}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${meta.text}`}>{group}</span>
                    </div>
                    {cols.map((col) => {
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
                  </div>
                );
              })}
            </div>

            <div className={`px-3.5 py-2 border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
              <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {visible.size} / {ALL_COLUMNS.length} ενεργές
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}