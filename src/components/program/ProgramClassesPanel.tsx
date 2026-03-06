import { Search, ChevronDown } from 'lucide-react';
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

export default function ProgramClassesPanel({
  classes, filteredClasses, classSearch, onSearchChange,
  subjectById, levelNameById, tutorNameById,
  isDark, dragClassId, onDragStart, onDragEnd, onAddSlot,
}: ProgramClassesPanelProps) {
  const panelCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const panelHeaderCls = isDark
    ? 'border-b border-slate-700/60 bg-slate-900/40 px-4 py-3'
    : 'border-b border-slate-200 bg-slate-50 px-4 py-3';

  const classCardCls = isDark
    ? 'group flex items-center justify-between gap-2 rounded-xl border border-slate-700/50 bg-slate-900/30 px-3 py-2.5 transition hover:border-slate-600/60 hover:bg-slate-800/40 cursor-grab active:cursor-grabbing'
    : 'group flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-100 cursor-grab active:cursor-grabbing';

  const daySelectCls = isDark
    ? 'h-7 appearance-none rounded-lg border border-slate-600/60 bg-slate-800/80 pl-2 pr-6 text-[10px] text-slate-200 outline-none transition hover:border-slate-500 focus:border-[color:var(--color-accent)]'
    : 'h-7 appearance-none rounded-lg border border-slate-300 bg-white pl-2 pr-6 text-[10px] text-slate-700 outline-none transition hover:border-slate-400 focus:border-[color:var(--color-accent)]';

  const searchInputCls = isDark
    ? 'h-8 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  return (
    <section className={`${panelCls} lg:w-[320px] shrink-0`}>
      <div className={panelHeaderCls}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
          Διαθέσιμα τμήματα
        </h2>
        <p className={`mt-0.5 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Σύρετε ή επιλέξτε μέρα για προσθήκη.
        </p>
      </div>

      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            className={searchInputCls}
            placeholder="Αναζήτηση τμήματος..."
            value={classSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {classes.length === 0 ? (
          <p className={`py-4 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δεν υπάρχουν ακόμη τμήματα.
          </p>
        ) : filteredClasses.length === 0 ? (
          <p className={`py-4 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δεν βρέθηκαν τμήματα.
          </p>
        ) : (
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-0.5">
            {filteredClasses.map((cls) => {
              const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
              const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
              const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
              const metaParts = [cls.subject, levelName, tutorName].filter(Boolean);

              return (
                <div key={cls.id}
                  className={classCardCls}
                  draggable
                  onDragStart={() => onDragStart(cls.id)}
                  onDragEnd={() => onDragEnd(cls.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                      {cls.title || 'Τμήμα'}
                    </div>
                    {metaParts.length > 0 && (
                      <div className={`mt-0.5 text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {metaParts.join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="relative shrink-0">
                    <select
                      className={daySelectCls}
                      defaultValue=""
                      onChange={(e) => {
                        const day = e.target.value;
                        if (!day) return;
                        onAddSlot(cls.id, day);
                        e.target.value = '';
                      }}
                    >
                      <option value="">+ Μέρα</option>
                      {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    <ChevronDown className={`pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
