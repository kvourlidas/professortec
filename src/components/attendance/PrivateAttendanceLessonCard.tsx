import { useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, DoorOpen, UserCheck, UserX } from 'lucide-react';
import type { AttendanceStatus, PrivateAttendanceRow, PrivateLessonSession } from './types';
import { formatDateDisplay, todayISO } from './utils';

interface Props {
  session: PrivateLessonSession;
  record: PrivateAttendanceRow | undefined;
  isDark: boolean;
  onMark: (session: PrivateLessonSession, status: AttendanceStatus) => void;
  onClear: (session: PrivateLessonSession) => void;
  onSaveReason: (session: PrivateLessonSession, reason: string) => void;
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

export default function PrivateAttendanceLessonCard({ session, record, isDark, onMark, onClear, onSaveReason, onConfirmDone }: Props) {
  const status = record?.status ?? null;
  const isComplete = !!record;

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
                {session.studentName}
              </h2>
              {session.date !== todayISO() && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isDark ? 'border-rose-500/40 bg-rose-500/10 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}>
                  <AlertTriangle className="h-3 w-3" />
                  Εκκρεμεί από {formatDateDisplay(session.date)}
                </span>
              )}
            </div>
            <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {session.subjectName && <span>{session.subjectName}</span>}
              {session.timeRange && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.timeRange}</span>
              )}
              {session.room && (
                <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3" />{session.room}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5">
          <span className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Η παρουσία καταχωρήθηκε.
          </span>
          <button type="button" onClick={onConfirmDone}
            className="btn-primary gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:brightness-110 active:scale-95">
            Μετάβαση στο ιστορικό
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => (status === 'present' ? onClear(session) : onMark(session, 'present'))} className={presentBtnCls(status === 'present')}>
              <UserCheck className="h-3.5 w-3.5" />Παρών
            </button>
            <button type="button" onClick={() => (status === 'absent' ? onClear(session) : onMark(session, 'absent'))} className={absentBtnCls(status === 'absent')}>
              <UserX className="h-3.5 w-3.5" />Απών
            </button>
          </div>
          {status === 'absent' && (
            <ReasonInput isDark={isDark} initial={record?.reason ?? ''} onSave={(v) => onSaveReason(session, v)} />
          )}
        </div>
      </div>
    </div>
  );
}
