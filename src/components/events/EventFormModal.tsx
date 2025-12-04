// src/components/events/EventFormModal.tsx
import { useEffect, useState } from 'react';

export type EventFormState = {
  name: string;
  description: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:MM" (24h)
  endTime: string;     // "HH:MM" (24h)
};

export type SchoolEventForEdit = {
  id: string;
  name: string;
  description: string | null;
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
};

type EventFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  editingEvent: SchoolEventForEdit | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: EventFormState) => void;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

// build 24h time options in 15' steps (00:00, 00:15, ..., 23:45)
const TIME_OPTIONS: string[] = (() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      arr.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return arr;
})();

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
  const [date, setDate] = useState('');

  const [startTime, setStartTime] = useState(''); // "HH:MM"
  const [endTime, setEndTime] = useState('');     // "HH:MM"

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && editingEvent) {
      setName(editingEvent.name);
      setDescription(editingEvent.description ?? '');
      setDate(editingEvent.date);

      // convert "HH:MM:SS" -> "HH:MM"
      setStartTime(editingEvent.start_time.slice(0, 5));
      setEndTime(editingEvent.end_time.slice(0, 5));
    } else {
      setName('');
      setDescription('');
      setDate('');
      setStartTime('');
      setEndTime('');
    }
  }, [open, mode, editingEvent]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const form: EventFormState = {
      name,
      description,
      date,
      startTime,
      endTime,
    };

    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-xl rounded-xl p-5 shadow-xl border border-slate-700"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-50">
            {mode === 'create' ? 'Νέα εκδήλωση' : 'Επεξεργασία εκδήλωσης'}
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
          <div className="mb-3 rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Όνομα */}
          <div>
            <label className="form-label text-slate-100">
              Όνομα εκδήλωσης *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
              placeholder="π.χ. Συνάντηση γονέων"
            />
          </div>

          {/* Περιγραφή */}
          <div>
            <label className="form-label text-slate-100">Περιγραφή</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
                resize: 'vertical',
              }}
              placeholder="Λεπτομέρειες, σημειώσεις, κλπ."
            />
          </div>

          {/* Ημερομηνία */}
          <div>
            <label className="form-label text-slate-100">
              Ημερομηνία *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="form-input"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
            />
          </div>

          {/* Ώρες – 24h dropdowns */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Ώρα έναρξης */}
            <div>
              <label className="form-label text-slate-100">
                Ώρα έναρξης *
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="form-input"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                <option value="">Επιλέξτε ώρα</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Ώρα λήξης */}
            <div>
              <label className="form-label text-slate-100">
                Ώρα λήξης *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="form-input"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                <option value="">Επιλέξτε ώρα</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Κουμπιά */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-main)',
              }}
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving
                ? 'Αποθήκευση...'
                : mode === 'create'
                ? 'Δημιουργία'
                : 'Αποθήκευση αλλαγών'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
