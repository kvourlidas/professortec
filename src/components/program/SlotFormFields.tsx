import type { ChangeEvent } from 'react';
import { CalendarDays, Calendar, BookOpen, GraduationCap, Layers, Clock } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
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
      <label className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
  onStartTimeChange: (t: string) => void;
  endTime: string;
  onEndTimeChange: (t: string) => void;
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
  startTime, onStartTimeChange,
  endTime, onEndTimeChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  subjOptions, tutorOptions,
  isEdit, isDark,
}: SlotFormFieldsProps) {
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-60'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-60';

  const selectCls = inputCls;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΤΜΗΜΑ" icon={<GraduationCap className="h-3 w-3" />} isDark={isDark}>
          <input disabled value={classTitle} className={inputCls} />
        </FormField>
        <FormField label="ΗΜΕΡΑ" icon={<CalendarDays className="h-3 w-3" />} isDark={isDark}>
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
        <FormField label="ΜΑΘΗΜΑ" icon={<BookOpen className="h-3 w-3" />} isDark={isDark}
          hint={subjOptions.length === 0 ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
          <select className={selectCls} value={subjectId ?? ''} onChange={onSubjectChange} disabled={subjOptions.length === 0}>
            <option value="">{subjOptions.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
            {subjOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="ΚΑΘΗΓΗΤΗΣ" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
          <select className={selectCls} value={tutorId ?? ''} onChange={onTutorChange} disabled={!subjectId || tutorOptions.length === 0}>
            <option value="">{tutorOptions.length === 0 ? 'Δεν έχουν οριστεί καθηγητές' : 'Επιλέξτε (προαιρετικό)'}</option>
            {tutorOptions.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΩΡΑ ΕΝΑΡΞΗΣ" icon={<Clock className="h-3 w-3" />} isDark={isDark}>
          <TimePicker value={startTime} onChange={onStartTimeChange} required />
        </FormField>
        <FormField label="ΩΡΑ ΛΗΞΗΣ" icon={<Clock className="h-3 w-3" />} isDark={isDark}>
          <TimePicker value={endTime} onChange={onEndTimeChange} required />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
          <AppDatePicker value={startDate} onChange={onStartDateChange} placeholder="π.χ. 12/05/2025" />
        </FormField>
        <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
          <AppDatePicker value={endDate} onChange={onEndDateChange} placeholder="π.χ. 12/05/2025" />
        </FormField>
      </div>
    </div>
  );
}
