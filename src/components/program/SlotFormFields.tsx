import type { ChangeEvent } from 'react';
import { CalendarDays, BookOpen, GraduationCap, Layers, DoorOpen } from 'lucide-react';
import DatePickerField from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  modalInputCls, modalSelectCls,
} from '../ui/ModalField';
import StyledSelect from '../ui/StyledSelect';
import { DAY_OPTIONS, DAY_LABEL_BY_VALUE } from './constants';
import type { SubjectRow, TutorRow } from './types';

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
  room: string;
  onRoomChange: (e: ChangeEvent<HTMLInputElement>) => void;
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
  room, onRoomChange,
  subjOptions, tutorOptions,
  isEdit, isDark,
}: SlotFormFieldsProps) {
  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΤΜΗΜΑ" isDark={isDark}>
          <FieldIcon icon={GraduationCap} isDark={isDark} />
          <input disabled value={classTitle} className={`${inputCls} disabled:opacity-60`} />
        </FormField>
        <FormField label="ΗΜΕΡΑ" isDark={isDark}>
          {isEdit && onDayChange ? (
            <>
              <FieldIcon icon={CalendarDays} isDark={isDark} />
              <StyledSelect
                isDark={isDark} className={selectCls}
                value={dayValue}
                onChange={(v) => onDayChange?.({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                options={DAY_OPTIONS.map((d) => ({ value: d.value, label: d.label }))}
              />
              <ModalSelectChevron isDark={isDark} />
            </>
          ) : (
            <>
              <FieldIcon icon={CalendarDays} isDark={isDark} />
              <input disabled value={DAY_LABEL_BY_VALUE[dayValue] || ''} className={`${inputCls} disabled:opacity-60`} />
            </>
          )}
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΜΑΘΗΜΑ" isDark={isDark}
          hint={subjOptions.length === 0 ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».' : undefined}>
          <FieldIcon icon={BookOpen} isDark={isDark} />
          <StyledSelect
            isDark={isDark} className={`${selectCls} disabled:opacity-60`}
            value={subjectId ?? ''}
            onChange={(v) => onSubjectChange({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
            disabled={subjOptions.length === 0}
            options={[
              { value: '', label: subjOptions.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα' },
              ...subjOptions.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <ModalSelectChevron isDark={isDark} />
        </FormField>
        <FormField label="ΚΑΘΗΓΗΤΗΣ" isDark={isDark}>
          <FieldIcon icon={Layers} isDark={isDark} />
          <StyledSelect
            isDark={isDark} className={`${selectCls} disabled:opacity-60`}
            value={tutorId ?? ''}
            onChange={(v) => onTutorChange({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
            disabled={!subjectId || tutorOptions.length === 0}
            options={[
              { value: '', label: tutorOptions.length === 0 ? 'Δεν έχουν οριστεί καθηγητές' : 'Επιλέξτε (προαιρετικό)' },
              ...tutorOptions.map((t) => ({ value: t.id, label: t.full_name })),
            ]}
          />
          <ModalSelectChevron isDark={isDark} />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΩΡΑ ΕΝΑΡΞΗΣ" isDark={isDark}>
          <TimePicker value={startTime} onChange={onStartTimeChange} required />
        </FormField>
        <FormField label="ΩΡΑ ΛΗΞΗΣ" isDark={isDark}>
          <TimePicker value={endTime} onChange={onEndTimeChange} required />
        </FormField>
      </div>

      <FormField label="ΑΙΘΟΥΣΑ" isDark={isDark}>
        <div className={`flex h-11 items-center gap-1.5 border-b transition-colors duration-200 ${
          isDark ? 'border-white/15 focus-within:border-[color:var(--color-accent)]' : 'border-slate-300 focus-within:border-[color:var(--color-accent)]'
        }`}>
          <DoorOpen className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`shrink-0 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Αίθουσα</span>
          <input
            value={room}
            onChange={onRoomChange}
            placeholder="π.χ. 2"
            className={`h-full w-full bg-transparent text-sm outline-none ${isDark ? 'text-slate-100 placeholder-slate-600' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ" isDark={isDark}>
          <DatePickerField label="" value={startDate} onChange={onStartDateChange} placeholder="π.χ. 12/05/2025" id="slot-start-date" variant="underline" />
        </FormField>
        <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ" isDark={isDark}>
          <DatePickerField label="" value={endDate} onChange={onEndDateChange} placeholder="π.χ. 12/05/2025" id="slot-end-date" variant="underline" />
        </FormField>
      </div>
    </div>
  );
}
