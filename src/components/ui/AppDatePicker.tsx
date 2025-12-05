// src/components/common/DatePickerField.tsx
import React, { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { CalendarDays } from 'lucide-react';
import { el } from 'date-fns/locale';
// ⚠️ Global CSS should already import react-datepicker styles:
// @import "react-datepicker/dist/react-datepicker.css";

// Greek month/day names (calendar only)
registerLocale('el', el);

type DatePickerFieldProps = {
  label?: string;
  value: string;              // ALWAYS dd/mm/yyyy
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** "dd/mm/yyyy" -> Date */
function parseDisplayToDate(display: string): Date | null {
  if (!display) return null;
  const parts = display.split(/[\/\-\.]/); // dd / mm / yyyy
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

/** Date -> "dd/mm/yyyy" */
function formatDateFromDate(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${d}/${m}/${y}`; // ✅ dd/mm/yyyy
}

// ---- limits for years ----
const MIN_YEAR = 1950;
const MAX_YEAR = 2070;
const MIN_DATE = new Date(MIN_YEAR, 0, 1);
const MAX_DATE = new Date(MAX_YEAR, 11, 31);

// ---- custom input (keeps your styling) ----
type DateInputProps = React.HTMLProps<HTMLInputElement> & {
  displayValue?: string; // our dd/mm/yyyy string from parent
};

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ displayValue, placeholder, onClick }, ref) => {
    return (
      <div className="relative cursor-pointer" onClick={onClick}>
        <input
          ref={ref}
          readOnly
          value={displayValue ?? ''}
          placeholder={placeholder}
          className="form-input w-full pr-9"
          style={{
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-main)',
          }}
        />
        <CalendarDays
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300"
        />
      </div>
    );
  },
);
DateInput.displayName = 'DateInput';

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value, // dd/mm/yyyy
  onChange,
  placeholder = 'ΗΗ/ΜΜ/ΕΕΕΕ',
  id,
}) => {
  const selected = value ? parseDisplayToDate(value) : null;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="form-label text-slate-100">
          {label}
        </label>
      )}

      <DatePicker
        id={id}
        locale="el"
        selected={selected ?? undefined}
        onChange={(date) => {
          const formatted = formatDateFromDate(date as Date | null);
          onChange(formatted);            // ✅ always dd/mm/yyyy in state
        }}
        dateFormat="dd/MM/yyyy"            // ✅ dd/MM in the input (internal)
        placeholderText={placeholder}
        customInput={<DateInput displayValue={value} />}
        wrapperClassName="w-full"
        calendarClassName="ct-datepicker"
        popperClassName="ct-datepicker-popper"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"             // use <select> for month/year
        scrollableYearDropdown            // list scrolls
        yearDropdownItemNumber={10}       // ~10 years visible at once
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
        shouldCloseOnSelect               // close popup on date click
      />
    </div>
  );
};

export default DatePickerField;
