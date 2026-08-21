import { useEffect, useRef, useState } from 'react';
import { Search, Plus, GripVertical, BookOpen, ChevronDown } from 'lucide-react';
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
  .classes-scroll::-webkit-scrollbar { width: 4px; }
  .classes-scroll::-webkit-scrollbar-track { background: transparent; }
  .classes-scroll::-webkit-scrollbar-thumb { border-radius: 9999px; background: rgba(148,163,184,0.35); }
  .classes-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.6); }
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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Προσθήκη σε μέρα"
        className={`flex h-6 items-center gap-1 rounded-md border pl-2 pr-1.5 text-[10px] font-medium transition ${
          open
            ? isDark
              ? 'border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
              : 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/8 text-[color:var(--color-accent)]'
            : isDark
              ? 'border-slate-700/60 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
        }`}
      >
        <Plus className="h-2.5 w-2.5 shrink-0" />
        Μέρα
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`day-picker-animate absolute left-0 top-full z-50 mt-1.5 min-w-[110px] overflow-hidden rounded-xl border py-1 shadow-md ${
          isDark
            ? 'border-slate-700/60 bg-slate-900'
            : 'border-slate-200 bg-white'
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
  const [open, setOpen] = useState(false);

  return (
    <div>
      <style>{PICKER_STYLE}</style>

      {/* Header — dropdown-style trigger, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
          isDark ? 'bg-slate-900 hover:border-slate-600/70' : 'bg-white hover:border-slate-300'
        } ${open ? 'border-[color:var(--color-accent)]' : isDark ? 'border-slate-700/60' : 'border-slate-200'}`}
      >
        <BookOpen className={`h-4 w-4 shrink-0 ${open ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}`}
          style={open ? { color: 'var(--color-accent)' } : undefined} />

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
            Διαθέσιμα τμήματα
          </div>
          <div className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {open ? 'Σύρετε ή επιλέξτε μέρα για προσθήκη' : 'Κλικ για ανάπτυξη'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`rounded-md border px-2.5 py-0.5 text-[10px] font-bold tabular-nums ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
            {filteredClasses.length} / {classes.length}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
      </button>

      {/* Expandable body — smooth grid animation */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0">
          <div className="pt-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                className={`h-8 w-full rounded-xl border pl-9 pr-3 text-xs outline-none transition sm:w-64 ${
                  isDark
                    ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                    : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                }`}
                placeholder="Αναζήτηση τμήματος…"
                value={classSearch}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Class grid */}
            {classes.length === 0 ? (
              <p className={`py-6 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Δεν υπάρχουν ακόμη τμήματα.
              </p>
            ) : filteredClasses.length === 0 ? (
              <p className={`py-6 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Δεν βρέθηκαν τμήματα.
              </p>
            ) : (
              <div className="classes-scroll max-h-[298px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredClasses.map((cls) => {
                  const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
                  const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
                  const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
                  const metaParts = [cls.subject, levelName, tutorName].filter(Boolean);

                  return (
                    <div
                      key={cls.id}
                      draggable
                      onDragStart={() => onDragStart(cls.id)}
                      onDragEnd={() => onDragEnd(cls.id)}
                      className={`group flex flex-col gap-2 rounded-lg border px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors active:scale-[0.97] ${
                        isDark
                          ? 'border-slate-700/50 hover:bg-blue-500/[0.12]'
                          : 'border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      {/* Top row: grip + title */}
                      <div className="flex items-start gap-1.5 min-w-0">
                        <GripVertical className={`mt-0.5 h-3 w-3 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <span className={`text-xs font-semibold leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {cls.title || 'Τμήμα'}
                        </span>
                      </div>

                      {/* Meta */}
                      {metaParts.length > 0 && (
                        <span className={`text-[10px] leading-tight truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {metaParts.join(' · ')}
                        </span>
                      )}

                      {/* Day picker */}
                      <DayPicker classId={cls.id} isDark={isDark} onAddSlot={onAddSlot} />
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
