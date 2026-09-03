// src/components/events/EventFormModal.tsx
import { useEffect, useState, type FormEvent } from 'react';
import DatePickerField from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import { CalendarDays, Type, X, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalErrorBox, modalInputCls,
} from '../ui/ModalField';

export type EventFormState = {
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type SchoolEventForEdit = {
  id: string;
  name: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
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

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}



export default function EventFormModal({
  open, mode, editingEvent, error, saving, onClose, onSubmit,
}: EventFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // ── Dynamic classes ──
  const inputCls = modalInputCls(isDark);

  const textareaCls = `w-full border-b bg-transparent pl-3 pr-2 py-2 text-sm outline-none transition-colors duration-200 min-h-[72px] resize-none ${
    isDark
      ? 'border-white/15 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]'
      : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
  }`;

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingEvent) {
      setName(editingEvent.name ?? '');
      setDescription(editingEvent.description ?? '');
      setDateDisplay(isoToDisplay(editingEvent.date));
      setStartTime(editingEvent.start_time?.slice(0, 5) ?? '');
      setEndTime(editingEvent.end_time?.slice(0, 5) ?? '');
    } else {
      setName(''); setDescription(''); setDateDisplay('');
      setStartTime(''); setEndTime('');
    }
  }, [open, mode, editingEvent]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      date: displayToIso(dateDisplay),
      startTime,
      endTime,
    });
  };

  useEscapeToClose(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
                {mode === 'create' ? 'Νέο event' : 'Επεξεργασία event'}
              </h2>
              {mode === 'edit' && editingEvent && (
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ch-text-muted)' }}>
                  {editingEvent.name}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </ModalErrorBox>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-2 space-y-4">

            {/* Name */}
            <FormField label="Όνομα event *" isDark={isDark}>
              <FieldIcon icon={Type} isDark={isDark} />
              <input
                className={inputCls}
                placeholder="π.χ. Παράσταση Χριστουγέννων"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </FormField>

            {/* Date */}
            <FormField label="Ημερομηνία *" isDark={isDark}>
              <DatePickerField
                label=""
                value={dateDisplay}
                onChange={setDateDisplay}
                placeholder="π.χ. 24/12/2025"
                variant="underline"
              />
            </FormField>

            {/* Time fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Ώρα έναρξης *" isDark={isDark}>
                <TimePicker value={startTime} onChange={setStartTime} required />
              </FormField>

              <FormField label="Ώρα λήξης *" isDark={isDark}>
                <TimePicker value={endTime} onChange={setEndTime} required />
              </FormField>
            </div>

            {/* Description */}
            <FormField label="Περιγραφή (προαιρετικά)" isDark={isDark}>
              <textarea
                className={textareaCls}
                placeholder="π.χ. Παράσταση με όλους τους μαθητές της Γ' Γυμνασίου"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>

          {/* Footer */}
          <div className={modalFooterCls}>
            <button type="button" onClick={onClose} disabled={saving} className={cancelBtnCls}>
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
            >
              {saving
                ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>
                : mode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}