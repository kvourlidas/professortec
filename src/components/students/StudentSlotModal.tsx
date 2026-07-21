import { useState, useEffect } from 'react';
import { CalendarDays, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import TimePicker from '../ui/TimePicker';
import AppDatePicker from '../ui/AppDatePicker';
import { displayToIso } from './types';

interface SubjectRow { id: string; name: string; }

interface StudentSlotModalProps {
  studentId: string;
  levelId: string | null;
  onClose: () => void;
  onCreated: (item: any) => void;
}

const DAYS = [
  { value: 'monday', label: 'Δευτέρα' },
  { value: 'tuesday', label: 'Τρίτη' },
  { value: 'wednesday', label: 'Τετάρτη' },
  { value: 'thursday', label: 'Πέμπτη' },
  { value: 'friday', label: 'Παρασκευή' },
  { value: 'saturday', label: 'Σάββατο' },
  { value: 'sunday', label: 'Κυριακή' },
];

function FormField({ label, children, isDark }: { label: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function StudentSlotModal({ studentId, levelId, onClose, onCreated }: StudentSlotModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState('monday');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chargePerSession, setChargePerSession] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSubjects = async () => {
      let q = supabase.from('subjects').select('id, name');
      if (levelId) q = q.eq('level_id', levelId);
      const { data } = await (q as any).order('name');
      setSubjects((data ?? []) as SubjectRow[]);
    };
    loadSubjects();
  }, [levelId]);

  const handleSave = async () => {
    const isoStart = displayToIso(startDate);
    const isoEnd = displayToIso(endDate);
    if (!startTime || !endTime || !isoStart || !isoEnd) {
      setError('Συμπλήρωσε ώρες και περίοδο.');
      return;
    }
    if (startTime >= endTime) {
      setError('Η ώρα έναρξης πρέπει να είναι πριν τη λήξη.');
      return;
    }
    if (isoStart > isoEnd) {
      setError('Η ημερομηνία έναρξης πρέπει να είναι πριν τη λήξη.');
      return;
    }
    setSaving(true);
    setError(null);
    const chargeVal = chargePerSession.trim() ? Number(chargePerSession.replace(',', '.')) : undefined;
    const res = await supabase.functions.invoke('student-slot-create', {
      body: {
        student_id: studentId,
        subject_id: subjectId || undefined,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        start_date: isoStart,
        end_date: isoEnd,
        charge_per_session: (chargeVal !== undefined && !isNaN(chargeVal)) ? chargeVal : undefined,
      },
    });
    setSaving(false);
    if (res.error || !res.data?.item) {
      setError(res.data?.error ?? res.error?.message ?? 'Αποτυχία αποθήκευσης.');
      return;
    }
    onCreated(res.data.item);
  };

  const selectCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const modalCardCls = isDark
    ? 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--ch-bg)', borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ch-text)' }}>
              Προσθήκη Ωραρίου
            </h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <div className="px-6 pb-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ΗΜΕΡΑ" isDark={isDark}>
              <select className={selectCls} value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </FormField>
            <FormField label="ΜΑΘΗΜΑ" isDark={isDark}>
              <select className={selectCls} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                <option value="">Επιλέξτε μάθημα (προαιρετικό)</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ΩΡΑ ΕΝΑΡΞΗΣ" isDark={isDark}>
              <TimePicker value={startTime} onChange={setStartTime} required />
            </FormField>
            <FormField label="ΩΡΑ ΛΗΞΗΣ" isDark={isDark}>
              <TimePicker value={endTime} onChange={setEndTime} required />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ" isDark={isDark}>
              <AppDatePicker value={startDate} onChange={setStartDate} placeholder="π.χ. 12/05/2025" />
            </FormField>
            <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ" isDark={isDark}>
              <AppDatePicker value={endDate} onChange={setEndDate} placeholder="π.χ. 12/05/2026" />
            </FormField>
          </div>

          <FormField label="ΧΡΕΩΣΗ ΑΝΑ ΜΑΘΗΜΑ (€)" isDark={isDark}>
            <input
              type="number"
              min="0"
              step="0.50"
              className={selectCls}
              value={chargePerSession}
              onChange={e => setChargePerSession(e.target.value)}
              placeholder="π.χ. 25.00"
            />
          </FormField>
        </div>

        <div className={modalFooterCls}>
          <button type="button" onClick={onClose} className={cancelBtnCls}>Ακύρωση</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση…</> : 'Προσθήκη'}
          </button>
        </div>
      </div>
    </div>
  );
}
