import { CalendarDays, Clock, DoorOpen } from 'lucide-react';
import { DAY_OPTIONS } from '../program/constants';
import { formatTimeDisplay } from '../program/utils';
import type { DeleteSlotTarget, PrivateLessonGroup, StudentRow, SubjectRow } from './types';

interface PrivateProgramScheduleGridProps {
  groupsByDay: Record<string, PrivateLessonGroup[]>;
  studentById: Map<string, StudentRow>;
  subjectById: Map<string, SubjectRow>;
  dragStudentId: string | null;
  isDark: boolean;
  onEditGroup: (group: PrivateLessonGroup) => void;
  onDeleteGroup: (target: DeleteSlotTarget) => void;
  onDragOver: (day: string) => void;
  onDrop: (day: string) => void;
}

const WEEKEND = new Set(['saturday', 'sunday']);

export default function PrivateProgramScheduleGrid({
  groupsByDay, studentById, subjectById,
  dragStudentId, isDark, onEditGroup, onDeleteGroup, onDragOver, onDrop,
}: PrivateProgramScheduleGridProps) {
  return (
    <section className="flex-1">
      <div className="flex shrink-0 items-center gap-2.5 pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <CalendarDays className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
        <h2 className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
          Εβδομαδιαίο πλάνο
        </h2>
      </div>

      <div className="overflow-x-auto pt-3">
        <div className={`min-w-[700px] grid grid-cols-7 border-t border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {DAY_OPTIONS.map((day) => {
            const isWeekend = WEEKEND.has(day.value);
            const groups = groupsByDay[day.value] ?? [];
            const isDragTarget = !!dragStudentId;

            return (
              <div key={day.value}
                className={`flex flex-col border-r border-b transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'} ${
                  isDragTarget
                    ? isDark
                      ? 'border-dashed border-slate-500/60 bg-slate-800/30'
                      : 'border-dashed border-slate-400/60 bg-slate-100/50'
                    : ''
                }`}
                onDragOver={(e) => { if (dragStudentId) { e.preventDefault(); onDragOver(day.value); } }}
                onDrop={() => onDrop(day.value)}
              >
                <div className={`border-b px-2 py-2 text-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <span className={`block text-[9px] font-bold uppercase tracking-widest ${
                    isWeekend ? (isDark ? 'text-slate-500' : 'text-slate-400') : (isDark ? 'text-slate-300' : 'text-slate-600')
                  }`}>
                    {day.label}
                  </span>
                </div>

                <div className={`flex-1 divide-y min-h-[120px] ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {groups.length === 0 ? (
                    <div className={`flex h-full min-h-[80px] items-center justify-center border border-dashed m-1.5 rounded-lg ${
                      isDark ? 'border-slate-800' : 'border-slate-300/60'
                    }`}>
                      <p className={`text-[9px] text-center px-1 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                        Σύρετε εδώ
                      </p>
                    </div>
                  ) : (
                    groups.map((group) => {
                      const names = group.items
                        .map((it) => studentById.get(it.student_id)?.full_name ?? 'Μαθητής')
                        .sort((a, b) => a.localeCompare(b, 'el'));
                      const subjName = group.subject_id ? (subjectById.get(group.subject_id)?.name ?? '') : '';
                      const timeRange = group.start_time && group.end_time
                        ? `${formatTimeDisplay(group.start_time)} – ${formatTimeDisplay(group.end_time)}`
                        : '';
                      const fees = group.items.map((it) => it.charge_per_session);
                      const uniqueFees = new Set(fees.map((f) => f ?? -1));
                      const label = names.join(', ');

                      return (
                        <div key={group.groupKey}
                          className={`group relative cursor-pointer overflow-hidden py-1.5 pl-2.5 pr-3 text-[10px] transition-colors ${
                            isDark ? 'hover:bg-[color:var(--color-accent)]/[0.12]' : 'hover:bg-[color:var(--color-accent)]/10'
                          }`}
                          onClick={() => onEditGroup(group)}
                        >
                          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--color-accent)' }} />

                          <button type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteGroup({ programItemId: group.items[0].id, label, dayLabel: day.label, timeRange });
                            }}
                            className={`absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded text-[9px] transition group-hover:flex ${
                              isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'
                            }`}
                          >
                            ✕
                          </button>

                          <div className={`font-semibold leading-tight pr-3 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {label}
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
                          {group.room && (
                            <div className={`mt-0.5 flex items-center gap-0.5 text-[9px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              <DoorOpen className="h-2.5 w-2.5 shrink-0" />
                              Αίθουσα {group.room}
                            </div>
                          )}
                          {fees.some((f) => f !== null) && (
                            <div className={`mt-0.5 text-[9px] truncate ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              {uniqueFees.size <= 1
                                ? (fees[0] !== null ? `${fees[0]}€ / συνεδρία` : '')
                                : group.items.map((it) => `${studentById.get(it.student_id)?.full_name ?? '—'}: ${it.charge_per_session ?? 0}€`).join(' · ')}
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
