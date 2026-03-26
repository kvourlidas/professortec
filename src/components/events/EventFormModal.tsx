// src/components/events/EventFormModal.tsx
import { useEffect, useState, type FormEvent } from 'react';
import DatePickerField from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import { CalendarDays, Clock, FileText, X, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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
  return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
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
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const textareaCls = isDark
    ? 'w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 min-h-[72px] resize-none'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 min-h-[72px] resize-none';

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-3'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-3';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  const labelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const FormField = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className={labelCls}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Accent top stripe */}
        <div
          className="h-0.5 w-full"
          style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              }}
            >
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                {mode === 'create' ? 'Νέο event' : 'Επεξεργασία event'}
              </h2>
              {mode === 'edit' && editingEvent && (
                <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {editingEvent.name}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className={modalCloseBtnCls}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-2 space-y-4">

            {/* Name */}
            <FormField label="ΟΝΟΜΑ EVENT *" icon={<CalendarDays className="h-3 w-3" />}>
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
            <FormField label="ΗΜΕΡΟΜΗΝΙΑ *" icon={<CalendarDays className="h-3 w-3" />}>
              <DatePickerField
                label=""
                value={dateDisplay}
                onChange={setDateDisplay}
                placeholder="π.χ. 24/12/2025"
              />
            </FormField>

            {/* Time fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="ΩΡΑ ΕΝΑΡΞΗΣ *" icon={<Clock className="h-3 w-3" />}>
                <TimePicker value={startTime} onChange={setStartTime} required />
              </FormField>

              <FormField label="ΩΡΑ ΛΗΞΗΣ *" icon={<Clock className="h-3 w-3" />}>
                <TimePicker value={endTime} onChange={setEndTime} required />
              </FormField>
            </div>

            {/* Description */}
            <FormField label="ΠΕΡΙΓΡΑΦΗ (ΠΡΟΑΙΡΕΤΙΚΑ)" icon={<FileText className="h-3 w-3" />}>
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