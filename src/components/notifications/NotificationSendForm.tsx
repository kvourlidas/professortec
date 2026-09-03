import React from 'react';
import { Send, Loader2, Users, GraduationCap, Globe } from 'lucide-react';
import type { RecipientMode, StudentOption, ClassOption } from './types';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';

interface NotificationSendFormProps {
  title: string;
  onTitleChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  recipientMode: RecipientMode;
  onRecipientModeChange: (v: RecipientMode) => void;
  selectedStudentIds: string[];
  onSelectedStudentIdsChange: (ids: string[]) => void;
  selectedClassIds: string[];
  onSelectedClassIdsChange: (ids: string[]) => void;
  students: StudentOption[];
  classes: ClassOption[];
  studentsLoading: boolean;
  classesLoading: boolean;
  loadingSend: boolean;
  errorMsg: string | null;
  resultMsg: string | null;
  onSend: () => void;
  isDark: boolean;
  isFrontistirio: boolean;
}

// ── Main form component ───────────────────────────────────────────────────────
export function NotificationSendForm({
  title, onTitleChange, body, onBodyChange,
  recipientMode, onRecipientModeChange,
  selectedStudentIds, onSelectedStudentIdsChange,
  selectedClassIds, onSelectedClassIdsChange,
  students, classes, studentsLoading, classesLoading,
  loadingSend, errorMsg, resultMsg, onSend, isDark, isFrontistirio,
}: NotificationSendFormProps) {

  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20'
    : 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/15';

  const textareaCls = isDark
    ? 'w-full resize-none rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20'
    : 'w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/15';

  const labelCls = `text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const MODES: { value: RecipientMode; label: string; icon: React.ReactNode }[] = [
    { value: 'all',      label: 'Όλοι',    icon: <Globe className="h-3.5 w-3.5" /> },
    { value: 'students', label: 'Μαθητές', icon: <Users className="h-3.5 w-3.5" /> },
    ...(isFrontistirio ? [{ value: 'classes' as RecipientMode, label: 'Τμήματα', icon: <GraduationCap className="h-3.5 w-3.5" /> }] : []),
  ];

  const toggleStudent = (id: string) =>
    onSelectedStudentIdsChange(selectedStudentIds.includes(id) ? selectedStudentIds.filter((s) => s !== id) : [...selectedStudentIds, id]);

  const toggleClass = (id: string) =>
    onSelectedClassIdsChange(selectedClassIds.includes(id) ? selectedClassIds.filter((c) => c !== id) : [...selectedClassIds, id]);

  const recipientSummary = () => {
    if (recipientMode === 'all') return <><span className={isDark ? 'font-semibold text-slate-300' : 'font-semibold text-slate-700'}>όλους</span> τους μαθητές.</>;
    if (recipientMode === 'students') {
      if (selectedStudentIds.length === 0) return <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-blue-500'}`}>Δεν έχεις επιλέξει μαθητές.</span>;
      return <><span className={isDark ? 'font-semibold text-slate-300' : 'font-semibold text-slate-700'}>{selectedStudentIds.length} μαθητές</span>.</>;
    }
    if (selectedClassIds.length === 0) return <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-blue-500'}`}>Δεν έχεις επιλέξει τμήματα.</span>;
    return <><span className={isDark ? 'font-semibold text-slate-300' : 'font-semibold text-slate-700'}>{selectedClassIds.length} τμήματα</span>.</>;
  };

  return (
    <div>
      {/* Header — accent underline, no card chrome */}
      <div className="flex shrink-0 items-center gap-2.5 pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <Send className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
        <span className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
          Νέα ειδοποίηση
        </span>
      </div>

      <div className="space-y-4 pt-5">

        {/* Title */}
        <div className="space-y-1.5">
          <label className={labelCls}>Τίτλος</label>
          <input className={inputCls} value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="π.χ. Ανακοίνωση" />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className={labelCls}>Μήνυμα</label>
          <textarea value={body} onChange={(e) => onBodyChange(e.target.value)} placeholder="Γράψε το μήνυμα…" rows={5} className={textareaCls} />
        </div>

        {/* Recipient toggle */}
        <div className="space-y-2.5">
          <label className={labelCls}>Αποστολή σε</label>
          <div className={`flex gap-1 rounded-xl p-1 ${isDark ? 'bg-slate-900/80 border border-slate-800' : 'bg-slate-100/80 border border-slate-200/80'}`}>
            {MODES.map(({ value, label, icon }) => {
              const active = recipientMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onRecipientModeChange(value)}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-2 text-[11px] font-semibold transition-all duration-200',
                    active
                      ? isDark ? 'text-black shadow-sm' : 'text-white shadow-sm'
                      : isDark
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-400 hover:text-slate-600',
                  ].join(' ')}
                  style={active ? { background: 'var(--color-accent)' } : {}}
                >
                  {icon}{label}
                </button>
              );
            })}
          </div>

          {/* Students multiselect */}
          {recipientMode === 'students' && (
            <div className="space-y-1.5">
              <label className={`${labelCls} text-[10px]`}>Επιλογή μαθητών</label>
              <MultiSelectDropdown
                items={students.map((s) => ({ id: s.id, label: s.full_name }))}
                selectedIds={selectedStudentIds}
                onToggle={toggleStudent}
                onClearAll={() => onSelectedStudentIdsChange([])}
                placeholder="Επίλεξε μαθητές…"
                emptyText="Δεν βρέθηκαν μαθητές"
                loading={studentsLoading}
                isDark={isDark}
              />
            </div>
          )}

          {/* Classes multiselect */}
          {recipientMode === 'classes' && (
            <div className="space-y-1.5">
              <label className={`${labelCls} text-[10px]`}>Επιλογή τμημάτων</label>
              <MultiSelectDropdown
                items={classes.map((c) => ({ id: c.id, label: c.title }))}
                selectedIds={selectedClassIds}
                onToggle={toggleClass}
                onClearAll={() => onSelectedClassIdsChange([])}
                placeholder="Επίλεξε τμήματα…"
                emptyText="Δεν βρέθηκαν τμήματα"
                loading={classesLoading}
                isDark={isDark}
              />
            </div>
          )}
        </div>

        {/* Send row */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Θα σταλεί σε {recipientSummary()}
          </p>
          <button
            onClick={onSend}
            disabled={loadingSend}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 transition-all"
          >
            {loadingSend
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποστολή…</>
              : <><Send className="h-3.5 w-3.5" />Στείλε ειδοποίηση</>}
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{errorMsg}
          </div>
        )}
        {resultMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{resultMsg}
          </div>
        )}
      </div>
    </div>
  );
}
