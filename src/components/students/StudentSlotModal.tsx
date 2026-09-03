import { useState, useEffect } from 'react';
import { CalendarDays, BookOpen, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import TimePicker from '../ui/TimePicker';
import DatePickerField from '../ui/AppDatePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  ModalErrorBox, modalInputCls, modalSelectCls,
} from '../ui/ModalField';
import StyledSelect from '../ui/StyledSelect';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
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

  useEscapeToClose(true, onClose);

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
    const chargeNum = chargePerSession.trim() ? Number(chargePerSession.replace(',', '.')) : null;
    if (chargeNum !== null && (Number.isNaN(chargeNum) || chargeNum <= 0)) {
      setError('Μη έγκυρο ποσό χρέωσης.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await supabase.functions.invoke('student-slot-create', {
      body: {
        student_id: studentId,
        subject_id: subjectId || undefined,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        start_date: isoStart,
        end_date: isoEnd,
        charge_per_session: chargeNum,
      },
    });
    setSaving(false);
    if (res.error || !res.data?.item) {
      setError(res.data?.error ?? res.error?.message ?? 'Αποτυχία αποθήκευσης.');
      return;
    }
    onCreated(res.data.item);
  };

  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);

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
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarDays className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
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
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        <div className="px-6 pb-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ΗΜΕΡΑ" isDark={isDark}>
              <FieldIcon icon={CalendarDays} isDark={isDark} />
              <StyledSelect
                isDark={isDark} className={selectCls}
                value={dayOfWeek} onChange={setDayOfWeek}
                options={DAYS.map(d => ({ value: d.value, label: d.label }))}
              />
              <ModalSelectChevron isDark={isDark} />
            </FormField>
            <FormField label="ΜΑΘΗΜΑ" isDark={isDark}>
              <FieldIcon icon={BookOpen} isDark={isDark} />
              <StyledSelect
                isDark={isDark} className={selectCls}
                value={subjectId} onChange={setSubjectId}
                options={[{ value: '', label: 'Επιλέξτε μάθημα (προαιρετικό)' }, ...subjects.map(s => ({ value: s.id, label: s.name }))]}
              />
              <ModalSelectChevron isDark={isDark} />
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
              <DatePickerField label="" value={startDate} onChange={setStartDate} placeholder="π.χ. 12/05/2025" id="student-slot-start-date" variant="underline" />
            </FormField>
            <FormField label="ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ" isDark={isDark}>
              <DatePickerField label="" value={endDate} onChange={setEndDate} placeholder="π.χ. 12/05/2026" id="student-slot-end-date" variant="underline" />
            </FormField>
          </div>

          <FormField label="ΧΡΕΩΣΗ ΑΝΑ ΣΥΝΕΔΡΙΑ (€)" isDark={isDark}>
            <input
              type="text"
              inputMode="decimal"
              className={`${inputCls} pl-3`}
              value={chargePerSession}
              onChange={e => setChargePerSession(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
              placeholder="π.χ. 25 (προαιρετικό)"
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
