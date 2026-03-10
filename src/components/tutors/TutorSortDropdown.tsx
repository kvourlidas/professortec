// src/components/tutors/TutorSortDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { triggerCls } from '../students/dropdownTriggerCls';

export type TutorSortField = 'full_name' | 'date_of_birth' | 'afm' | 'phone' | 'email';
export type SortDir = 'asc' | 'desc';
export interface TutorSortState { field: TutorSortField; dir: SortDir; }

export const DEFAULT_TUTOR_SORT: TutorSortState = { field: 'full_name', dir: 'asc' };

const SORT_OPTIONS: { field: TutorSortField; label: string }[] = [
  { field: 'full_name',     label: 'Ονοματεπώνυμο' },
  { field: 'date_of_birth', label: 'Ημ. Γέννησης'  },
  { field: 'afm',           label: 'ΑΦΜ'            },
  { field: 'phone',         label: 'Τηλέφωνο'       },
  { field: 'email',         label: 'Email'           },
];

type Props = { sort: TutorSortState; onChange: (s: TutorSortState) => void; isDark: boolean; };

export default function TutorSortDropdown({ sort, onChange, isDark }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const activeLabel = SORT_OPTIONS.find(o => o.field === sort.field)?.label ?? '';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={triggerCls(open, isDark)}>
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-60" />
        <span>Ταξινόμηση</span>
        <span
          className="inline-flex items-center rounded-sm px-1 text-[9px] font-bold"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}
        >
          {sort.dir === 'asc' ? '↑' : '↓'} {activeLabel}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-2xl border shadow-2xl
            ${isDark ? 'border-white/10 bg-slate-900/90 shadow-black/60' : 'border-slate-200/80 bg-white/90 shadow-slate-300/50'}`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          <div className={`px-3.5 py-2.5 border-b text-[11px] font-semibold ${isDark ? 'border-white/[0.07] text-slate-200' : 'border-slate-100 text-slate-700'}`}>
            Ταξινόμηση κατά
          </div>
          {SORT_OPTIONS.map(({ field, label }) =>
            (['asc', 'desc'] as SortDir[]).map(dir => {
              const active = sort.field === field && sort.dir === dir;
              return (
                <button
                  key={`${field}-${dir}`}
                  type="button"
                  onClick={() => { onChange({ field, dir }); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-[7px] text-[11px] transition-colors duration-100
                    ${active
                      ? isDark ? 'bg-white/[0.06] text-slate-100' : 'bg-slate-100 text-slate-800'
                      : isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  <span>{label} <span className="opacity-50">{dir === 'asc' ? '↑ Α→Ω' : '↓ Ω→Α'}</span></span>
                  {active && <Check className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}