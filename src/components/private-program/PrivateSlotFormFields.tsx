import { useState, type ChangeEvent } from 'react';
import { CalendarDays, BookOpen, Plus, Users, X } from 'lucide-react';
import DatePickerField from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  modalInputCls, modalSelectCls,
} from '../ui/ModalField';
import StyledSelect from '../ui/StyledSelect';
import { DAY_OPTIONS, DAY_LABEL_BY_VALUE } from '../program/constants';
import type { RosterEntry, StudentRow, SubjectRow } from './types';

interface PrivateSlotFormFieldsProps {
  dayValue: string;
  onDayChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  subjectId: string | null;
  onSubjectChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  startTime: string;
  onStartTimeChange: (t: string) => void;
  endTime: string;
  onEndTimeChange: (t: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  roster: RosterEntry[];
  onAddStudent: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  onChargeChange: (studentId: string, value: string) => void;
  studentById: Map<string, StudentRow>;
  availableStudents: StudentRow[];
  subjOptions: SubjectRow[];
  isEdit: boolean;
  isDark: boolean;
}

export function PrivateSlotFormFields({
  dayValue, onDayChange,
  subjectId, onSubjectChange,
  startTime, onStartTimeChange,
  endTime, onEndTimeChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  roster, onAddStudent, onRemoveStudent, onChargeChange,
  studentById, availableStudents,
  subjOptions, isEdit, isDark,
}: PrivateSlotFormFieldsProps) {
  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);
  const [overridingPeriod, setOverridingPeriod] = useState(false);

  const startPeriodOverride = () => {
    onStartDateChange('');
    onEndDateChange('');
    setOverridingPeriod(true);
  };

  return (
    <div className="space-y-4">
      <FormField label="ΜΑΘΗΤΕΣ" isDark={isDark}>
        <div className="space-y-2">
          {roster.length === 0 && (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν προστεθεί μαθητές.</p>
          )}
          {roster.map((r, idx) => (
            <div key={r.studentId} className="flex items-center gap-2">
              <span className={`w-4 shrink-0 text-right text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {idx + 1}
              </span>
              <span className={`flex-1 truncate text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {studentById.get(r.studentId)?.full_name ?? 'Μαθητής'}
              </span>
              <input
                type="text" inputMode="decimal"
                value={r.charge}
                onChange={(e) => onChargeChange(r.studentId, e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                placeholder="€ (προαιρ.)"
                className={`h-8 w-24 rounded-lg border px-2 text-xs outline-none transition ${
                  isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
                }`}
              />
              <button type="button" onClick={() => onRemoveStudent(r.studentId)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {availableStudents.length > 0 && (
          <div className="relative mt-2.5">
            <FieldIcon icon={Plus} isDark={isDark} />
            <StyledSelect
              isDark={isDark} className={selectCls}
              value="" onChange={(v) => { if (v) onAddStudent(v); }}
              placeholder="Προσθήκη μαθητή στο μάθημα…"
              options={availableStudents.map((s) => ({ value: s.id, label: s.full_name ?? 'Μαθητής' }))}
            />
            <ModalSelectChevron isDark={isDark} />
          </div>
        )}
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
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
        <FormField label="ΜΑΘΗΜΑ" isDark={isDark}
          hint={subjOptions.length === 0 ? 'Ρυθμίστε τα μαθήματα στη σελίδα «Μαθήματα».' : undefined}>
          <FieldIcon icon={BookOpen} isDark={isDark} />
          <StyledSelect
            isDark={isDark} className={selectCls}
            value={subjectId ?? ''}
            onChange={(v) => onSubjectChange({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
            options={[
              { value: '', label: 'Επιλέξτε μάθημα (προαιρετικό)' },
              ...subjOptions.map((s) => ({ value: s.id, label: s.name })),
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

      {overridingPeriod ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ" isDark={isDark}>
            <DatePickerField label="" value={startDate} onChange={onStartDateChange} placeholder="π.χ. 12/05/2025" id="private-slot-start-date" variant="underline" />
          </FormField>
          <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ" isDark={isDark}>
            <DatePickerField label="" value={endDate} onChange={onEndDateChange} placeholder="π.χ. 12/05/2025" id="private-slot-end-date" variant="underline" />
          </FormField>
        </div>
      ) : (
        <>
          <FormField label="ΠΕΡΙΟΔΟΣ" isDark={isDark}>
            <FieldIcon icon={CalendarDays} isDark={isDark} />
            <input disabled value={startDate && endDate ? `${startDate} – ${endDate}` : 'Δεν έχει οριστεί περίοδος'} className={`${inputCls} disabled:opacity-60`} />
          </FormField>
          <button type="button" onClick={startPeriodOverride}
            className="flex items-center gap-1 text-[11px] font-semibold transition hover:underline"
            style={{ color: 'var(--color-accent)' }}>
            <Users className="h-3 w-3" />Αλλαγή περιόδου
          </button>
        </>
      )}
    </div>
  );
}
