import type { ChangeEvent } from 'react';
import { CalendarDays, Clock, Calendar, BookOpen, GraduationCap, Layers } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import { DAY_OPTIONS, DAY_LABEL_BY_VALUE } from './constants';
import type { SubjectRow, TutorRow } from './types';

interface FormFieldProps {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  isDark: boolean;
}

export function FormField({ label, icon, hint, children, isDark }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-amber-500">{hint}</p>}
    </div>
  );
}

interface SlotFormFieldsProps {
  classTitle: string;
  dayValue: string;
  onDayChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  subjectId: string | null;
  onSubjectChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  tutorId: string | null;
  onTutorChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  startTime: string;
  onStartTimeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  startPeriod: 'AM' | 'PM';
  onStartPeriodChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  endTime: string;
  onEndTimeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  endPeriod: 'AM' | 'PM';
  onEndPeriodChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  subjOptions: SubjectRow[];
  tutorOptions: TutorRow[];
  isEdit: boolean;
  isDark: boolean;
}

export function SlotFormFields({
  classTitle, dayValue, onDayChange,
  subjectId, onSubjectChange,
  tutorId, onTutorChange,
  startTime, onStartTimeChange, startPeriod, onStartPeriodChange,
  endTime, onEndTimeChange, endPeriod, onEndPeriodChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  subjOptions, tutorOptions,
  isEdit, isDark,
}: SlotFormFieldsProps) {
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-60'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-60';

  const selectCls = inputCls;

  const timeInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-3 pr-20 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-3 pr-20 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const periodSelectCls = isDark
    ? 'absolute inset-y-1 right-1 w-16 rounded-md border border-slate-600/60 bg-slate-800 px-1.5 text-[10px] text-slate-200 outline-none'
    : 'absolute inset-y-1 right-1 w-16 rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[10px] text-slate-700 outline-none';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Τμήμα" icon={<GraduationCap className="h-3 w-3" />} isDark={isDark}>
          <input disabled value={classTitle} className={inputCls} />
        </FormField>
        <FormField label="Ημέρα" icon={<CalendarDays className="h-3 w-3" />} isDark={isDark}>
          {isEdit && onDayChange ? (
            <select className={selectCls} value={dayValue} onChange={onDayChange}>
              {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          ) : (
            <input disabled value={DAY_LABEL_BY_VALUE[dayValue] || ''} className={inputCls} />
          )}
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Μάθημα" icon={<BookOpen className="h-3 w-3" />} isDark={isDark}
          hint={subjOptions.length === 0 ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
          <select className={selectCls} value={subjectId ?? ''} onChange={onSubjectChange} disabled={subjOptions.length === 0}>
            <option value="">{subjOptions.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
            {subjOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Καθηγητής" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
          <select className={selectCls} value={tutorId ?? ''} onChange={onTutorChange} disabled={!subjectId || tutorOptions.length === 0}>
            <option value="">{tutorOptions.length === 0 ? 'Δεν έχουν οριστεί καθηγητές' : 'Επιλέξτε (προαιρετικό)'}</option>
            {tutorOptions.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Ώρα έναρξης', time: startTime, onChange: onStartTimeChange, period: startPeriod, onPeriod: onStartPeriodChange },
          { label: 'Ώρα λήξης', time: endTime, onChange: onEndTimeChange, period: endPeriod, onPeriod: onEndPeriodChange },
        ].map(({ label, time, onChange, period, onPeriod }) => (
          <FormField key={label} label={label} icon={<Clock className="h-3 w-3" />} isDark={isDark}>
            <div className="relative">
              <input type="text" inputMode="numeric" placeholder="π.χ. 08:00" value={time} onChange={onChange} className={timeInputCls} />
              <select value={period} onChange={onPeriod} className={periodSelectCls}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </FormField>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Ημερομηνία έναρξης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
          <AppDatePicker value={startDate} onChange={onStartDateChange} placeholder="π.χ. 12/05/2025" />
        </FormField>
        <FormField label="Ημερομηνία λήξης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
          <AppDatePicker value={endDate} onChange={onEndDateChange} placeholder="π.χ. 12/05/2025" />
        </FormField>
      </div>
    </div>
  );
}
