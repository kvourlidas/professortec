import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock, DoorOpen, User, UserCheck, UserX } from 'lucide-react';
import type { AttendanceRow, AttendanceStatus, LessonSession } from './types';

interface Props {
  session: LessonSession;
  attendanceByStudent: Map<string, AttendanceRow>;
  isComplete: boolean;
  isDark: boolean;
  onMark: (session: LessonSession, studentId: string, status: AttendanceStatus) => void;
  onClear: (session: LessonSession, studentId: string) => void;
  onSaveReason: (session: LessonSession, studentId: string, reason: string) => void;
  onConfirmDone: () => void;
}

function ReasonInput({ isDark, initial, onSave }: { isDark: boolean; initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value.trim() !== (initial ?? '').trim()) onSave(value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder="Λόγος απουσίας (προαιρετικό)"
      className={`h-7 w-full rounded-lg border px-2.5 text-[11px] outline-none transition sm:w-64 ${
        isDark
          ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]'
          : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
      }`}
    />
  );
}

export default function AttendanceLessonCard({ session, attendanceByStudent, isComplete, isDark, onMark, onClear, onSaveReason, onConfirmDone }: Props) {
  const answered = session.roster.filter((s) => attendanceByStudent.has(s.id)).length;

  const presentBtnCls = (active: boolean) => `flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
    active
      ? 'border-emerald-500 bg-emerald-500 text-white'
      : isDark
        ? 'border-slate-700/60 text-slate-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400'
        : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600'
  }`;

  const absentBtnCls = (active: boolean) => `flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
    active
      ? 'border-rose-500 bg-rose-500 text-white'
      : isDark
        ? 'border-slate-700/60 text-slate-400 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400'
        : 'border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600'
  }`;

  return (
    <div>
      {/* Header — accent underline, no card chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-5 w-5 shrink-0" style={{ color: 'var(--color-accent)' }} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
                {session.classTitle}
              </h2>
              {session.isTest && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                  <ClipboardList className="h-3 w-3" />
                  {session.testTitle ? `Διαγώνισμα · ${session.testTitle}` : 'Διαγώνισμα'}
                </span>
              )}
            </div>
            <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {session.subjectName && <span>{session.subjectName}</span>}
              {session.tutorName && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{session.tutorName}</span>
              )}
              {session.timeRange && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.timeRange}</span>
              )}
              {session.room && (
                <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3" />{session.room}</span>
              )}
            </div>
          </div>
        </div>
        <span className={`shrink-0 text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {answered} / {session.roster.length} απάντησαν
        </span>
      </div>

      {isComplete && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5">
          <span className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Όλες οι παρουσίες καταχωρήθηκαν.
          </span>
          <button type="button" onClick={onConfirmDone}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition active:scale-95"
            style={{ background: 'var(--color-accent)', color: 'var(--ch-icon)' }}>
            Μετάβαση στο ιστορικό
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
        {session.roster.map((student) => {
          const record = attendanceByStudent.get(student.id);
          const status = record?.status ?? null;
          return (
            <div key={student.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {student.full_name ?? 'Χωρίς όνομα'}
              </span>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => (status === 'present' ? onClear(session, student.id) : onMark(session, student.id, 'present'))} className={presentBtnCls(status === 'present')}>
                    <UserCheck className="h-3.5 w-3.5" />Παρών
                  </button>
                  <button type="button" onClick={() => (status === 'absent' ? onClear(session, student.id) : onMark(session, student.id, 'absent'))} className={absentBtnCls(status === 'absent')}>
                    <UserX className="h-3.5 w-3.5" />Απών
                  </button>
                </div>
                {status === 'absent' && (
                  <ReasonInput isDark={isDark} initial={record?.reason ?? ''} onSave={(v) => onSaveReason(session, student.id, v)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
