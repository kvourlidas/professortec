// src/components/events/EventFormModal.tsx
import { useEffect, useState, type FormEvent } from 'react';
import DatePickerField from '../ui/AppDatePicker';

export type EventFormState = {
  name: string;
  description: string;
  date: string;      // ISO: YYYY-MM-DD (what EventsPage expects)
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
};

export type SchoolEventForEdit = {
  id: string;
  name: string;
  description: string;
  date: string;        // ISO: YYYY-MM-DD
  start_time: string;  // HH:MM:SS (24h)
  end_time: string;    // HH:MM:SS (24h)
};

type ModalMode = 'create' | 'edit';

type EventFormModalProps = {
  open: boolean;
  mode: ModalMode;
  editingEvent: SchoolEventForEdit | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: EventFormState) => void;
};

// YYYY-MM-DD → dd/mm/yyyy
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

// dd/mm/yyyy → YYYY-MM-DD
function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/); // dd / mm / yyyy
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// "HH:MM" (24h) → { time: "HH:MM" (12h), period: "AM" | "PM" }
function from24To12(hhmm: string): { time: string; period: 'AM' | 'PM' } {
  const [hStr, mStr] = hhmm.split(':');
  const hour24 = Number(hStr ?? 0);
  const mm = (mStr ?? '00').padStart(2, '0');

  let period: 'AM' | 'PM' = 'AM';
  let hour12 = hour24;

  if (hour24 === 0) {
    hour12 = 12;
    period = 'AM';
  } else if (hour24 === 12) {
    hour12 = 12;
    period = 'PM';
  } else if (hour24 > 12) {
    hour12 = hour24 - 12;
    period = 'PM';
  } else {
    period = 'AM';
  }

  const hh12 = String(hour12).padStart(2, '0');
  return { time: `${hh12}:${mm}`, period };
}

// "HH:MM" (12h) + period → "HH:MM" (24h)
function from12To24(time12: string, period: 'AM' | 'PM'): string {
  if (!time12) return '';
  const [hStr, mStr] = time12.split(':');
  let hour = Number(hStr ?? 0);
  const mm = (mStr ?? '00').padStart(2, '0');

  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else {
    // PM
    if (hour !== 12) hour = hour + 12;
  }

  const hh24 = String(hour).padStart(2, '0');
  return `${hh24}:${mm}`;
}

// automatically keep time as "HH:MM" while user types
function autoFormatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 0) return '';
  if (digits.length <= 2) {
    // typing hours
    return digits;
  }

  const hh = digits.slice(0, 2);
  const mm = digits.slice(2, 4); // up to 2 digits for minutes

  return `${hh}:${mm}`;
}

export default function EventFormModal({
  open,
  mode,
  editingEvent,
  error,
  saving,
  onClose,
  onSubmit,
}: EventFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // controlled by AppDatePicker (dd/mm/yyyy)
  const [dateDisplay, setDateDisplay] = useState('');
  // 12h time + period (for UI)
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('AM');

  // Prefill when opening modal
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && editingEvent) {
      setName(editingEvent.name ?? '');
      setDescription(editingEvent.description ?? '');
      setDateDisplay(isoToDisplay(editingEvent.date));

      const start24 = editingEvent.start_time
        ? editingEvent.start_time.slice(0, 5)
        : '';
      const end24 = editingEvent.end_time
        ? editingEvent.end_time.slice(0, 5)
        : '';

      if (start24) {
        const { time, period } = from24To12(start24);
        setStartTime(time);
        setStartPeriod(period);
      } else {
        setStartTime('');
        setStartPeriod('AM');
      }

      if (end24) {
        const { time, period } = from24To12(end24);
        setEndTime(time);
        setEndPeriod(period);
      } else {
        setEndTime('');
        setEndPeriod('AM');
      }
    } else {
      setName('');
      setDescription('');
      setDateDisplay('');
      setStartTime('');
      setEndTime('');
      setStartPeriod('AM');
      setEndPeriod('AM');
    }
  }, [open, mode, editingEvent]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const isoDate = displayToIso(dateDisplay);
    const start24 = from12To24(startTime, startPeriod);
    const end24 = from12To24(endTime, endPeriod);

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      date: isoDate,      // YYYY-MM-DD
      startTime: start24, // HH:MM (24h)
      endTime: end24,     // HH:MM (24h)
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50">
            {mode === 'create' ? 'Νέο event' : 'Επεξεργασία event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-slate-100"
          >
            Κλείσιμο
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded bg-red-900/60 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Όνομα */}
          <div>
            <label className="form-label text-slate-100">
              Όνομα event *
            </label>
            <input
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              placeholder="π.χ. Παράσταση Χριστουγέννων"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Ημερομηνία (AppDatePicker / DatePickerField) */}
          <DatePickerField
            label="Ημερομηνία *"
            value={dateDisplay}                // dd/mm/yyyy
            onChange={setDateDisplay}          // dd/mm/yyyy
            placeholder="π.χ. 24/12/2025"
          />

          {/* Ώρες με AM/PM όπως στο ProgramPage */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Ώρα έναρξης */}
            <div>
              <label className="form-label text-slate-100">
                Ώρα έναρξης *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="π.χ. 08:00"
                  value={startTime}
                  onChange={(e) =>
                    setStartTime(autoFormatTimeInput(e.target.value))
                  }
                  className="form-input pr-12"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  required
                />
                <select
                  value={startPeriod}
                  onChange={(e) =>
                    setStartPeriod(e.target.value as 'AM' | 'PM')
                  }
                  className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            {/* Ώρα λήξης */}
            <div>
              <label className="form-label text-slate-100">
                Ώρα λήξης *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="π.χ. 09:30"
                  value={endTime}
                  onChange={(e) =>
                    setEndTime(autoFormatTimeInput(e.target.value))
                  }
                  className="form-input pr-12"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  required
                />
                <select
                  value={endPeriod}
                  onChange={(e) =>
                    setEndPeriod(e.target.value as 'AM' | 'PM')
                  }
                  className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Περιγραφή */}
          <div>
            <label className="form-label text-slate-100">
              Περιγραφή (προαιρετικά)
            </label>
            <textarea
              className="form-input min-h-[70px]"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              placeholder="π.χ. Παράσταση με όλους τους μαθητές της Γ' Γυμνασίου"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              disabled={saving}
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving
                ? 'Αποθήκευση…'
                : mode === 'create'
                ? 'Αποθήκευση'
                : 'Ενημέρωση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
