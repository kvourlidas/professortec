import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, Loader2, Users, GraduationCap, Globe, Check, ChevronDown, Search, X } from 'lucide-react';
import type { RecipientMode, StudentOption, ClassOption } from './types';

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
}

// ── Portal MultiSelect – escapes overflow:hidden on any ancestor ─────────────
function MultiSelect({
  items, selectedIds, onToggle, onClearAll, placeholder, emptyText, loading, isDark,
}: {
  items: { id: string; label: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
  placeholder: string;
  emptyText: string;
  loading: boolean;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()));
  const selectedItems = items.filter((i) => selectedIds.includes(i.id));

  const triggerCls = [
    'flex min-h-[2.625rem] w-full cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs transition-all duration-150',
    open
      ? isDark
        ? 'border border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/20 bg-slate-900/80'
        : 'border border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/15 bg-white'
      : isDark
      ? 'border border-slate-700/70 bg-slate-900/60 hover:border-slate-600/80'
      : 'border border-slate-200 bg-white hover:border-slate-300',
  ].join(' ');

  // KEY FIX: background color set via inline style (not Tailwind) so it can't be
  // overridden by backdrop-blur compositing. backgroundImage: 'none' blocks any
  // page gradient from bleeding through the transparency in the corners.
  const dropdownInlineStyle: React.CSSProperties = isDark
    ? { backgroundColor: 'rgba(15, 22, 35, 0.55)', backgroundImage: 'none' }
    : { backgroundColor: 'rgba(255, 255, 255, 0.55)', backgroundImage: 'none' };

  const portal = open && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
    >
      <div
        className={[
          'overflow-hidden rounded-2xl',
          'shadow-[0_12px_40px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]',
          isDark
            ? 'border border-slate-700/50 backdrop-blur-2xl ring-1 ring-inset ring-white/[0.07]'
            : 'border border-slate-200/80 backdrop-blur-2xl ring-1 ring-inset ring-black/[0.04]',
        ].join(' ')}
        style={dropdownInlineStyle}
      >
        {/* Corner bleed mask – covers the top-right area where page gradient bleeds through */}
        {isDark && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '45%', height: '38%',
            background: 'radial-gradient(ellipse at top right, rgba(13,19,30,0.92) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 0, borderRadius: '0 1rem 0 0',
          }} />
        )}
        {!isDark && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '45%', height: '38%',
            background: 'radial-gradient(ellipse at top right, rgba(248,249,251,0.92) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 0, borderRadius: '0 1rem 0 0',
          }} />
        )}
        {/* Search */}
        <div className={`relative z-10 flex items-center gap-2.5 border-b px-4 py-3 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          <Search className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Αναζήτηση…"
            className={`flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-slate-100 placeholder-slate-600' : 'text-slate-700 placeholder-slate-400'}`}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              <X className={`h-3 w-3 transition-colors ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`} />
            </button>
          )}
        </div>

        {/* Items */}
        <div
          className="relative z-10 max-h-52 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(100,116,139,0.35) transparent' : 'rgba(148,163,184,0.35) transparent' }}
        >
          {loading ? (
            <div className={`flex items-center justify-center gap-2 py-8 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />Φόρτωση…
            </div>
          ) : filtered.length === 0 ? (
            <div className={`py-8 text-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{emptyText}</div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filtered.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-all duration-100',
                      selected
                        ? isDark ? 'bg-[color-mix(in_srgb,var(--color-accent)_13%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]'
                        : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md transition-all duration-150"
                      style={selected
                        ? { background: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-accent) 22%, transparent)' }
                        : { border: `1.5px solid ${isDark ? 'rgba(100,116,139,0.6)' : '#cbd5e1'}`, background: 'transparent' }
                      }
                    >
                      {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className={selected
                      ? isDark ? 'font-medium text-slate-100' : 'font-medium text-slate-800'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                    }>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedIds.length > 0 && (
          <div className={`relative z-10 flex items-center justify-between border-t px-4 py-2.5 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}
            >
              {selectedIds.length} επιλεγμένα
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              className={`text-[10px] font-medium transition-colors hover:underline ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Καθαρισμός όλων
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={triggerRef} className="relative">
      <div className={triggerCls} onClick={() => setOpen((v) => !v)}>
        <div className="flex flex-1 flex-wrap gap-1.5 py-0.5">
          {selectedItems.length === 0 ? (
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{placeholder}</span>
          ) : selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
                color: 'var(--color-accent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 32%, transparent)',
              }}
            >
              {item.label}
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onToggle(item.id); }} />
            </span>
          ))}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
      {portal}
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────
export function NotificationSendForm({
  title, onTitleChange, body, onBodyChange,
  recipientMode, onRecipientModeChange,
  selectedStudentIds, onSelectedStudentIdsChange,
  selectedClassIds, onSelectedClassIdsChange,
  students, classes, studentsLoading, classesLoading,
  loadingSend, errorMsg, resultMsg, onSend, isDark,
}: NotificationSendFormProps) {

  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20'
    : 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/15';

  const textareaCls = isDark
    ? 'w-full resize-none rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20'
    : 'w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/15';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const labelCls = `text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const MODES: { value: RecipientMode; label: string; icon: React.ReactNode }[] = [
    { value: 'all',      label: 'Όλοι',    icon: <Globe className="h-3.5 w-3.5" /> },
    { value: 'students', label: 'Μαθητές', icon: <Users className="h-3.5 w-3.5" /> },
    { value: 'classes',  label: 'Τμήματα', icon: <GraduationCap className="h-3.5 w-3.5" /> },
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
    <div className={cardCls}>
      {/* Accent line */}
      <div className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 25%, transparent))' }}
      />

      {/* Header */}
      <div className={`flex items-center gap-3 border-b px-5 py-3.5 rounded-t-[calc(1rem-1px)] ${isDark ? 'border-slate-700/60 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
          <Send className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
          Νέα ειδοποίηση
        </span>
      </div>

      <div className="space-y-4 p-5">

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
              <MultiSelect
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
              <MultiSelect
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