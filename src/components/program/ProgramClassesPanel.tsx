import { useEffect, useRef, useState } from 'react';
import { Search, GripVertical, Plus } from 'lucide-react';
import { DAY_OPTIONS } from './constants';
import type { ClassRow, SubjectRow } from './types';

interface ProgramClassesPanelProps {
  classes: ClassRow[];
  filteredClasses: ClassRow[];
  classSearch: string;
  onSearchChange: (v: string) => void;
  subjectById: Map<string, SubjectRow>;
  levelNameById: Map<string, string>;
  tutorNameById: Map<string, string>;
  isDark: boolean;
  dragClassId: string | null;
  onDragStart: (classId: string) => void;
  onDragEnd: (classId: string) => void;
  onAddSlot: (classId: string, day: string) => void;
}

const PICKER_STYLE = `
  @keyframes pickerFadeIn {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .day-picker-animate { animation: pickerFadeIn 0.14s cubic-bezier(0.16,1,0.3,1) forwards; }
`;

function DayPicker({ classId, isDark, onAddSlot }: {
  classId: string;
  isDark: boolean;
  onAddSlot: (classId: string, day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition ${
          open
            ? isDark
              ? 'border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
              : 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/8 text-[color:var(--color-accent)]'
            : isDark
              ? 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
        }`}
      >
        <Plus className="h-2.5 w-2.5" />
        Μέρα
      </button>

      {open && (
        <div className={`day-picker-animate absolute right-0 top-full z-50 mt-1.5 min-w-[110px] overflow-hidden rounded-xl border py-1 shadow-xl ${
          isDark
            ? 'border-slate-700/60 bg-slate-900 ring-1 ring-white/[0.06]'
            : 'border-slate-200 bg-white ring-1 ring-slate-900/5'
        }`}>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => { onAddSlot(classId, d.value); setOpen(false); }}
              className={`flex w-full items-center px-3 py-1.5 text-left text-[11px] font-medium transition-colors ${
                isDark
                  ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgramClassesPanel({
  classes, filteredClasses, classSearch, onSearchChange,
  subjectById, levelNameById, tutorNameById,
  isDark, dragClassId: _dragClassId, onDragStart, onDragEnd, onAddSlot,
}: ProgramClassesPanelProps) {
  return (
    <section className={`lg:w-[300px] shrink-0 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-1 ring-inset ring-white/[0.04]'
        : 'border-slate-200 bg-white'
    }`}>
      <style>{PICKER_STYLE}</style>
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      {/* Header */}
      <div className={`flex items-center gap-2.5 border-b px-4 py-3.5 ${isDark ? 'border-slate-800/70 bg-slate-900/30' : 'border-slate-100 bg-slate-50/80'}`}>
        <div className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
          <GripVertical className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <h2 className={`text-xs font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            Διαθέσιμα τμήματα
          </h2>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Σύρετε ή επιλέξτε μέρα για προσθήκη
          </p>
        </div>
      </div>

      {/* Search */}
      <div className={`border-b px-3 py-2.5 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            className={`h-8 w-full rounded-xl border pl-9 pr-3 text-xs outline-none transition ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
            }`}
            placeholder="Αναζήτηση τμήματος…"
            value={classSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="p-2.5">
        {classes.length === 0 ? (
          <p className={`py-6 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δεν υπάρχουν ακόμη τμήματα.
          </p>
        ) : filteredClasses.length === 0 ? (
          <p className={`py-6 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δεν βρέθηκαν τμήματα.
          </p>
        ) : (
          <div className="max-h-[500px] space-y-px overflow-y-auto">
            {filteredClasses.map((cls) => {
              const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
              const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
              const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
              const metaParts = [cls.subject, levelName, tutorName].filter(Boolean);

              return (
                <div key={cls.id}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition cursor-grab active:cursor-grabbing ${
                    isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                  }`}
                  draggable
                  onDragStart={() => onDragStart(cls.id)}
                  onDragEnd={() => onDragEnd(cls.id)}
                >
                  <span className={`h-1 w-1 shrink-0 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />

                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {cls.title || 'Τμήμα'}
                    </div>
                    {metaParts.length > 0 && (
                      <div className={`mt-0.5 text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {metaParts.join(' · ')}
                      </div>
                    )}
                  </div>

                  <DayPicker classId={cls.id} isDark={isDark} onAddSlot={onAddSlot} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`border-t px-4 py-2 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
        <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {filteredClasses.length} τμήματα
        </span>
      </div>
    </section>
  );
}
