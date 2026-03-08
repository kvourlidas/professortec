// src/components/students/SortDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Check, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { triggerCls } from './dropdownTriggerCls';

export type SortField =
  | 'full_name' | 'level' | 'date_of_birth' | 'created_at' | 'phone' | 'email';

export type SortDir = 'asc' | 'desc';

export type SortState = { field: SortField; dir: SortDir };

export const DEFAULT_SORT: SortState = { field: 'full_name', dir: 'asc' };

const SORT_OPTIONS: { field: SortField; label: string; group: string }[] = [
  { field: 'full_name',     label: 'Ονοματεπώνυμο', group: 'Αλφαβητικά' },
  { field: 'level',         label: 'Επίπεδο',        group: 'Αλφαβητικά' },
  { field: 'email',         label: 'Email',           group: 'Αλφαβητικά' },
  { field: 'phone',         label: 'Τηλέφωνο',       group: 'Αλφαβητικά' },
  { field: 'date_of_birth', label: 'Ημ. Γέννησης',   group: 'Χρονολογικά' },
  { field: 'created_at',    label: 'Ημ. Εγγραφής',   group: 'Χρονολογικά' },
];

const GROUPS = ['Αλφαβητικά', 'Χρονολογικά'];

type Props = {
  sort: SortState;
  onChange: (s: SortState) => void;
  isDark: boolean;
};

export default function SortDropdown({ sort, onChange, isDark }: Props) {
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

  const selectField = (field: SortField) => {
    if (sort.field === field) {
      onChange({ field, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      const defaultDir: SortDir = field === 'created_at' || field === 'date_of_birth' ? 'desc' : 'asc';
      onChange({ field, dir: defaultDir });
    }
    setOpen(false);
  };

  const currentLabel = SORT_OPTIONS.find((o) => o.field === sort.field)?.label ?? '—';
  const DirIcon = sort.dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls(open, isDark)}>
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-60" />
        <span>{currentLabel}</span>
        {/* Direction chip */}
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
            color: 'var(--color-accent)',
          }}
        >
          <DirIcon className="h-2 w-2" strokeWidth={2.5} />
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-2xl border shadow-2xl
            ${isDark ? 'border-white/10 bg-slate-900/90 shadow-black/60' : 'border-slate-200/80 bg-white/90 shadow-slate-300/50'}`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Ταξινόμηση</span>
            <button
              type="button"
              onClick={() => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
              className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-all
                ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              {sort.dir === 'asc'
                ? <><ArrowUp className="h-2.5 w-2.5" /> Αύξουσα</>
                : <><ArrowDown className="h-2.5 w-2.5" /> Φθίνουσα</>}
            </button>
          </div>

          {GROUPS.map((group, gi) => {
            const opts = SORT_OPTIONS.filter((o) => o.group === group);
            return (
              <div key={group}>
                <div
                  className={`flex items-center gap-1.5 px-3.5 py-1.5
                    ${gi > 0 ? `border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}` : ''}
                    ${isDark ? 'bg-slate-900/90' : 'bg-white/90'}`}
                >
                  <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {group}
                  </span>
                </div>
                {opts.map((opt) => {
                  const active = sort.field === opt.field;
                  return (
                    <button
                      key={opt.field}
                      type="button"
                      onClick={() => selectField(opt.field)}
                      className={`flex w-full items-center gap-2.5 px-3.5 py-[7px] text-[11px] transition-colors duration-100
                        ${active
                          ? isDark ? 'bg-white/[0.06] text-white' : 'bg-slate-50 text-slate-900'
                          : isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-all
                          ${active ? 'border-transparent' : isDark ? 'border-slate-600' : 'border-slate-300'}`}
                        style={active ? { background: 'var(--color-accent)' } : undefined}
                      >
                        {active && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="flex-1 text-left leading-none">{opt.label}</span>
                      {active && (
                        <span style={{ color: 'var(--color-accent)' }}>
                          <DirIcon className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className={`px-3.5 py-2 border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-100'}`}>
            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Κλικ στο ίδιο πεδίο για αντιστροφή
            </span>
          </div>
        </div>
      )}
    </div>
  );
}