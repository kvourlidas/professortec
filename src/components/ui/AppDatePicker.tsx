// src/components/ui/AppDatePicker.tsx
import React, { forwardRef, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CalendarDays } from 'lucide-react';
import { el } from 'date-fns/locale';

registerLocale('el', el);

type DatePickerFieldProps = {
  label?: string;
  value: string; // ALWAYS dd/mm/yyyy
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

function parseDisplayToDate(display: string): Date | null {
  if (!display) return null;
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr), month = Number(mStr), year = Number(yStr);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function formatDateFromDate(date: Date | null): string {
  if (!date) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

type DateInputProps = React.HTMLProps<HTMLInputElement> & {
  displayValue?: string;
};

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ displayValue, placeholder, onClick }, ref) => (
    <div className="relative cursor-pointer" onClick={onClick}>
      <input
        ref={ref}
        readOnly
        value={displayValue ?? ''}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-3 pr-9 text-xs text-slate-100 placeholder-slate-500 outline-none transition cursor-pointer focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30"
      />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
    </div>
  ),
);
DateInput.displayName = 'DateInput';

const PORTAL_ID = 'ct-datepicker-portal';

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'ΗΗ/ΜΜ/ΕΕΕΕ',
  id,
}) => {
  const selected = value ? parseDisplayToDate(value) : null;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(PORTAL_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = PORTAL_ID;
      document.body.appendChild(el);
    }

    // Inject calendar styles once
    const styleId = 'ct-datepicker-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .ct-datepicker-popper {
          z-index: 9999 !important;
        }
        .ct-datepicker {
          background: rgb(2 6 23 / 0.95) !important;
          border: 1px solid rgb(51 65 85 / 0.6) !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 20px 40px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.04) inset !important;
          backdrop-filter: blur(12px) !important;
          padding: 0.75rem !important;
          font-family: inherit !important;
        }
        .ct-datepicker .react-datepicker__header {
          background: transparent !important;
          border-bottom: 1px solid rgb(51 65 85 / 0.5) !important;
          padding-bottom: 0.5rem !important;
          margin-bottom: 0.25rem !important;
        }
        .ct-datepicker .react-datepicker__current-month {
          color: rgb(241 245 249) !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          letter-spacing: 0.025em !important;
          margin-bottom: 0.4rem !important;
        }
        .ct-datepicker .react-datepicker__navigation {
          top: 0.85rem !important;
        }
        .ct-datepicker .react-datepicker__navigation-icon::before {
          border-color: rgb(148 163 184) !important;
          border-width: 2px 2px 0 0 !important;
          width: 7px !important;
          height: 7px !important;
        }
        .ct-datepicker .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
          border-color: rgb(241 245 249) !important;
        }
        .ct-datepicker .react-datepicker__day-names {
          margin-top: 0.25rem !important;
        }
        .ct-datepicker .react-datepicker__day-name {
          color: rgb(100 116 139) !important;
          font-size: 0.625rem !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          width: 2rem !important;
          line-height: 2rem !important;
          margin: 0 !important;
        }
        .ct-datepicker .react-datepicker__month {
          margin: 0 !important;
        }
        .ct-datepicker .react-datepicker__day {
          color: rgb(203 213 225) !important;
          font-size: 0.7rem !important;
          font-weight: 400 !important;
          width: 2rem !important;
          height: 2rem !important;
          line-height: 2rem !important;
          border-radius: 0.5rem !important;
          margin: 0 !important;
          transition: background 0.1s, color 0.1s !important;
        }
        .ct-datepicker .react-datepicker__day:hover {
          background: rgb(255 255 255 / 0.07) !important;
          color: rgb(241 245 249) !important;
          border-radius: 0.5rem !important;
        }
        .ct-datepicker .react-datepicker__day--selected,
        .ct-datepicker .react-datepicker__day--keyboard-selected {
          background: var(--color-accent) !important;
          color: #000 !important;
          font-weight: 600 !important;
          border-radius: 0.5rem !important;
        }
        .ct-datepicker .react-datepicker__day--selected:hover {
          background: var(--color-accent) !important;
          filter: brightness(1.1) !important;
        }
        .ct-datepicker .react-datepicker__day--today {
          background: rgb(255 255 255 / 0.05) !important;
          color: var(--color-accent) !important;
          font-weight: 600 !important;
          border-radius: 0.5rem !important;
        }
        .ct-datepicker .react-datepicker__day--today.react-datepicker__day--selected {
          background: var(--color-accent) !important;
          color: #000 !important;
        }
        .ct-datepicker .react-datepicker__day--outside-month {
          color: rgb(51 65 85) !important;
        }
        .ct-datepicker .react-datepicker__day--disabled {
          color: rgb(51 65 85) !important;
          cursor: not-allowed !important;
        }
        .ct-datepicker .react-datepicker__day--disabled:hover {
          background: transparent !important;
        }
        /* Month/Year dropdowns */
        .ct-datepicker .react-datepicker__month-select,
        .ct-datepicker .react-datepicker__year-select {
          background: rgb(15 23 42 / 0.8) !important;
          border: 1px solid rgb(51 65 85 / 0.7) !important;
          border-radius: 0.375rem !important;
          color: rgb(203 213 225) !important;
          font-size: 0.7rem !important;
          padding: 0.2rem 0.4rem !important;
          outline: none !important;
          cursor: pointer !important;
        }
        .ct-datepicker .react-datepicker__month-dropdown-container,
        .ct-datepicker .react-datepicker__year-dropdown-container {
          margin: 0 0.2rem !important;
        }
        /* Triangle/arrow */
        .ct-datepicker-popper .react-datepicker__triangle {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </label>
      )}
      <DatePicker
        id={id}
        locale="el"
        selected={selected}
        onChange={(date) => onChange(formatDateFromDate(date as Date | null))}
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        customInput={<DateInput displayValue={value} />}
        wrapperClassName="w-full"
        calendarClassName="ct-datepicker"
        popperClassName="ct-datepicker-popper"
        portalId={PORTAL_ID}
        popperProps={{ strategy: 'fixed' }}
        popperPlacement="bottom-start"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        scrollableYearDropdown
        yearDropdownItemNumber={10}
      />
    </div>
  );
};

export default DatePickerField;