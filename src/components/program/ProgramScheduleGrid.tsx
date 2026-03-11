import { Clock } from 'lucide-react';
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

export default function ProgramScheduleGrid({
  itemsByDay, classes, subjectById, tutorNameById,
  dragClassId, isDark, onEditSlot, onDeleteSlot, onDragOver, onDrop,
}: ProgramScheduleGridProps) {
  const panelCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const panelHeaderCls = isDark
    ? 'border-b border-slate-700/60 bg-slate-900/40 px-4 py-3'
    : 'border-b border-slate-200 bg-slate-50 px-4 py-3';

  return (
    <section className={`flex-1 ${panelCls}`}>
      <div className={panelHeaderCls}>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
          ΕΒΔΟΜΑΔΙΑΙΟ ΠΛΑΝΟ
        </h2>
      </div>

      <div className="overflow-x-auto p-3">
        <div className="min-w-[700px] grid grid-cols-7 gap-2">
          {DAY_OPTIONS.map((day) => (
            <div key={day.value}
              className={`flex flex-col rounded-xl border transition-colors ${
                dragClassId
                  ? isDark ? 'border-dashed border-slate-500/60 bg-slate-800/30' : 'border-dashed border-slate-400/60 bg-slate-100/60'
                  : isDark ? 'border-slate-700/40 bg-slate-900/20' : 'border-slate-200 bg-slate-50/60'
              }`}
              onDragOver={(e) => { if (dragClassId) { e.preventDefault(); onDragOver(day.value); } }}
              onDrop={() => onDrop(day.value)}
            >
              <div className={`border-b px-2 py-2 text-center text-[9px] font-bold uppercase tracking-widest ${isDark ? 'border-slate-700/40' : 'border-slate-200'}`}
                style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                {day.label}
              </div>

              <div className="flex-1 space-y-1.5 p-1.5 min-h-[120px]">
                {itemsByDay[day.value]?.length === 0 ? (
                  <div className={`flex h-full min-h-[80px] items-center justify-center rounded-lg border border-dashed ${isDark ? 'border-slate-700/40 bg-white/[0.02]' : 'border-slate-300/60 bg-white/40'}`}>
                    <p className={`text-[9px] text-center px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      Σύρετε τμήμα εδώ
                    </p>
                  </div>
                ) : (
                  itemsByDay[day.value].map((item) => {
                    const cls = classes.find((c) => c.id === item.class_id);
                    if (!cls) return null;
                    const subjForItem = item.subject_id ? subjectById.get(item.subject_id) : cls.subject_id ? subjectById.get(cls.subject_id) : null;
                    const subjName = subjForItem?.name ?? cls.subject ?? '';
                    const tutorNameForItem = item.tutor_id ? (tutorNameById.get(item.tutor_id) ?? '') : cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
                    const timeRange = item.start_time && item.end_time ? `${formatTimeDisplay(item.start_time)} – ${formatTimeDisplay(item.end_time)}` : '';
                    const classLabel = [cls.title, subjName, tutorNameForItem].filter(Boolean).join(' · ');

                    return (
                      <div key={item.id}
                        className={`group relative cursor-pointer rounded-lg border px-2 py-1.5 text-[10px] transition ${
                          isDark
                            ? 'border-slate-600/40 bg-slate-800/50 hover:border-[color:var(--color-accent)]/50 hover:bg-slate-700/50'
                            : 'border-slate-200 bg-white hover:border-[color:var(--color-accent)]/50 hover:bg-slate-50'
                        }`}
                        onClick={() => onEditSlot(item)}
                      >
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSlot({ id: item.id, classLabel, dayLabel: DAY_LABEL_BY_VALUE[item.day_of_week] ?? '', timeRange });
                          }}
                          className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded text-[9px] text-red-400 hover:text-red-300 group-hover:flex"
                        >
                          ✕
                        </button>
                        <div className={`font-semibold leading-tight pr-3 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          {cls.title}
                        </div>
                        {subjName && <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subjName}</div>}
                        {timeRange && (
                          <div className={`mt-1 flex items-center gap-0.5 text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Clock className="h-2.5 w-2.5" />{timeRange}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
