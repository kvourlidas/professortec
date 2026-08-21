import { CalendarDays, Clock } from 'lucide-react';
import { DAY_OPTIONS, DAY_LABEL_BY_VALUE } from './constants';
import { formatTimeDisplay } from './utils';
import type { ClassRow, ProgramItemRow, SubjectRow, DeleteSlotTarget } from './types';

interface ProgramScheduleGridProps {
  itemsByDay: Record<string, ProgramItemRow[]>;
  classes: ClassRow[];
  subjectById: Map<string, SubjectRow>;
  tutorNameById: Map<string, string>;
  dragClassId: string | null;
  isDark: boolean;
  onEditSlot: (item: ProgramItemRow) => void;
  onDeleteSlot: (target: DeleteSlotTarget) => void;
  onDragOver: (day: string) => void;
  onDrop: (day: string) => void;
}

const WEEKEND = new Set(['saturday', 'sunday']);

export default function ProgramScheduleGrid({
  itemsByDay, classes, subjectById, tutorNameById,
  dragClassId, isDark, onEditSlot, onDeleteSlot, onDragOver, onDrop,
}: ProgramScheduleGridProps) {
  return (
    <section className="flex-1">
      {/* Header — accent underline, no card chrome */}
      <div className="flex shrink-0 items-center gap-2.5 pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <CalendarDays className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
        <h2 className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
          Εβδομαδιαίο πλάνο
        </h2>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pt-3">
        <div className={`min-w-[700px] grid grid-cols-7 border-t border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {DAY_OPTIONS.map((day) => {
            const isWeekend = WEEKEND.has(day.value);
            const slots = itemsByDay[day.value] ?? [];
            const isDragTarget = !!dragClassId;

            return (
              <div key={day.value}
                className={`flex flex-col border-r border-b transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'} ${
                  isDragTarget
                    ? isDark
                      ? 'border-dashed border-slate-500/60 bg-slate-800/30'
                      : 'border-dashed border-slate-400/60 bg-slate-100/50'
                    : ''
                }`}
                onDragOver={(e) => { if (dragClassId) { e.preventDefault(); onDragOver(day.value); } }}
                onDrop={() => onDrop(day.value)}
              >
                {/* Day header */}
                <div className={`border-b px-2 py-2 text-center ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <span className={`block text-[9px] font-bold uppercase tracking-widest ${
                    isWeekend
                      ? isDark ? 'text-slate-500' : 'text-slate-400'
                      : isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {day.label}
                  </span>
                </div>

                {/* Slots */}
                <div className={`flex-1 divide-y min-h-[120px] ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {slots.length === 0 ? (
                    <div className={`flex h-full min-h-[80px] items-center justify-center border border-dashed m-1.5 rounded-lg ${
                      isDark ? 'border-slate-800' : 'border-slate-300/60'
                    }`}>
                      <p className={`text-[9px] text-center px-1 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                        Σύρετε εδώ
                      </p>
                    </div>
                  ) : (
                    slots.map((item) => {
                      const cls = classes.find((c) => c.id === item.class_id);
                      if (!cls) return null;
                      const subjForItem = item.subject_id
                        ? subjectById.get(item.subject_id)
                        : cls.subject_id ? subjectById.get(cls.subject_id) : null;
                      const subjName = subjForItem?.name ?? cls.subject ?? '';
                      const tutorNameForItem = item.tutor_id
                        ? (tutorNameById.get(item.tutor_id) ?? '')
                        : cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
                      const timeRange = item.start_time && item.end_time
                        ? `${formatTimeDisplay(item.start_time)} – ${formatTimeDisplay(item.end_time)}`
                        : '';
                      const classLabel = [cls.title, subjName, tutorNameForItem].filter(Boolean).join(' · ');

                      return (
                        <div key={item.id}
                          className={`group relative cursor-pointer overflow-hidden py-1.5 pl-2.5 pr-3 text-[10px] transition-colors ${
                            isDark ? 'hover:bg-blue-500/[0.12]' : 'hover:bg-blue-50'
                          }`}
                          onClick={() => onEditSlot(item)}
                        >
                          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--color-accent)' }} />

                          {/* Delete button */}
                          <button type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSlot({ id: item.id, classLabel, dayLabel: DAY_LABEL_BY_VALUE[item.day_of_week] ?? '', timeRange });
                            }}
                            className={`absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded text-[9px] transition group-hover:flex ${
                              isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'
                            }`}
                          >
                            ✕
                          </button>

                          <div className={`font-semibold leading-tight pr-3 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {cls.title}
                          </div>
                          {subjName && (
                            <div className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {subjName}
                            </div>
                          )}
                          {timeRange && (
                            <div className="mt-1 flex items-center gap-0.5 text-[9px]"
                              style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, transparent)' }}>
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              {timeRange}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
