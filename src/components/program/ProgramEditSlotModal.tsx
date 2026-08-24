import type { ChangeEvent } from 'react';
import { CalendarDays, X, Loader2 } from 'lucide-react';
import { SlotFormFields } from './SlotFormFields';
import type { EditSlotForm, ClassRow, SubjectRow, TutorRow } from './types';

interface ProgramEditSlotModalProps {
  open: boolean;
  form: EditSlotForm | null;
  saving: boolean;
  error: string | null;
  classes: ClassRow[];
  subjOptions: SubjectRow[];
  tutorOptions: TutorRow[];
  isDark: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFieldChange: (field: keyof EditSlotForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onStartTimeChange: (t: string) => void;
  onEndTimeChange: (t: string) => void;
  onDateChange: (field: 'startDate' | 'endDate') => (v: string) => void;
}

export default function ProgramEditSlotModal({
  open, form, saving, error, classes, subjOptions, tutorOptions, isDark,
  onClose, onSubmit, onFieldChange, onStartTimeChange, onEndTimeChange, onDateChange,
}: ProgramEditSlotModalProps) {
  if (!open || !form) return null;

  const currentClass = classes.find((c) => c.id === form.classId) ?? null;

  const modalCardCls = isDark
    ? 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Επεξεργασία στο πρόγραμμα</h2>
              {currentClass && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ch-text-muted)' }}>{currentClass.title}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <div className="px-6 pb-2">
          <SlotFormFields
            classTitle={currentClass?.title ?? ''}
            dayValue={form.day}
            onDayChange={onFieldChange('day')}
            isEdit={true}
            subjectId={form.subjectId}
            onSubjectChange={onFieldChange('subjectId')}
            tutorId={form.tutorId}
            onTutorChange={onFieldChange('tutorId')}
            startTime={form.startTime}
            onStartTimeChange={onStartTimeChange}
            endTime={form.endTime}
            onEndTimeChange={onEndTimeChange}
            startDate={form.startDate}
            onStartDateChange={onDateChange('startDate')}
            endDate={form.endDate}
            onEndDateChange={onDateChange('endDate')}
            room={form.room}
            onRoomChange={onFieldChange('room')}
            subjOptions={subjOptions}
            tutorOptions={tutorOptions}
            isDark={isDark}
          />
        </div>

        <div className={modalFooterCls}>
          <button type="button" onClick={onClose} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={onSubmit} disabled={saving}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Ενημέρωση…</> : 'Ενημέρωση'}
          </button>
        </div>
      </div>
    </div>
  );
}
