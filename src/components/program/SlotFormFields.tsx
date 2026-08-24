import type { ChangeEvent } from 'react';
import { CalendarDays, BookOpen, GraduationCap, Layers, DoorOpen } from 'lucide-react';
import DatePickerField from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  modalInputCls, modalSelectCls,
} from '../ui/ModalField';
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
              <select className={selectCls} value={dayValue} onChange={onDayChange}>
                {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
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
          <select className={`${selectCls} disabled:opacity-60`} value={subjectId ?? ''} onChange={onSubjectChange} disabled={subjOptions.length === 0}>
            <option value="">{subjOptions.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}</option>
            {subjOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ModalSelectChevron isDark={isDark} />
        </FormField>
        <FormField label="ΚΑΘΗΓΗΤΗΣ" isDark={isDark}>
          <FieldIcon icon={Layers} isDark={isDark} />
          <select className={`${selectCls} disabled:opacity-60`} value={tutorId ?? ''} onChange={onTutorChange} disabled={!subjectId || tutorOptions.length === 0}>
            <option value="">{tutorOptions.length === 0 ? 'Δεν έχουν οριστεί καθηγητές' : 'Επιλέξτε (προαιρετικό)'}</option>
            {tutorOptions.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
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
        <FieldIcon icon={DoorOpen} isDark={isDark} />
        <input value={room} onChange={onRoomChange} placeholder="π.χ. Αίθουσα 2" className={inputCls} />
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
