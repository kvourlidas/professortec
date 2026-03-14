import { CalendarDays, ChevronDown, Loader2, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AppDatePicker from '../../ui/AppDatePicker';
import { typeColors } from './constants';
import { CURRENCY_SYMBOL } from './constants';
import {
  isHourlyPackageName, isMonthlyPackageName, isYearlyPackageName,
  money, packageTypeFromName, typeLabel,
} from './utils';
import type { PackageRow, PeriodMode, StudentRow } from './types';

interface Props {
  open: boolean;
  isRenew: boolean;
  saving: boolean;
  assignError: string | null;
  isDark: boolean;
  selStudent: StudentRow | null;
  allStudents: StudentRow[];
  studentQ: string;
  setStudentQ: (v: string) => void;
  studentDrop: boolean;
  setStudentDrop: (v: boolean | ((p: boolean) => boolean)) => void;
  onStudentSelect: (s: StudentRow) => void;
  selPackage: PackageRow | null;
  packages: PackageRow[];
  packageQ: string;
  setPackageQ: (v: string) => void;
  packageDrop: boolean;
  setPackageDrop: (v: boolean | ((p: boolean) => boolean)) => void;
  onPackageSelect: (p: PackageRow) => void;
  customPrice: string;
  setCustomPrice: (v: string) => void;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  /** The hook's computed final price — used only when submitting.
   *  Display uses localFinalPrice computed here based on discountMode. */
  assignFinalPrice: number;
  assignPeriodMode: PeriodMode;
  setAssignPeriodMode: (m: PeriodMode) => void;
  assignMonthNum: string;
  setAssignMonthNum: (v: string) => void;
  assignYear: string;
  setAssignYear: (v: string) => void;
  assignStartsOn: string;
  setAssignStartsOn: (v: string) => void;
  assignEndsOn: string;
  setAssignEndsOn: (v: string) => void;
  monthOptions: { value: string; label: string }[];
  yearOptions: string[];
  assignPeriodDisplay: () => string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export function AssignRenewModal({
  open, isRenew, saving, assignError, isDark,
  selStudent, allStudents, studentQ, setStudentQ, studentDrop, setStudentDrop, onStudentSelect,
  selPackage, packages, packageQ, setPackageQ, packageDrop, setPackageDrop, onPackageSelect,
  customPrice, setCustomPrice, discountPct, setDiscountPct,
  assignPeriodMode, setAssignPeriodMode, assignMonthNum, setAssignMonthNum, assignYear, setAssignYear,
  assignStartsOn, setAssignStartsOn, assignEndsOn, setAssignEndsOn,
  monthOptions, yearOptions, assignPeriodDisplay,
  onClose, onSubmit,
}: Props) {
  const [discountMode, setDiscountMode] = useState<'pct' | 'amount'>('pct');

  // Compute final price locally so it reacts to discountMode immediately
  const localFinalPrice = useMemo(() => {
    const base = customPrice.trim()
      ? Math.max(0, Number(customPrice.replace(',', '.')) || 0)
      : Number(selPackage?.price ?? 0);
    const disc = Number(discountPct.replace(',', '.')) || 0;
    if (discountMode === 'pct') {
      return Math.max(0, Math.round(base * (1 - disc / 100) * 100) / 100);
    } else {
      return Math.max(0, Math.round((base - disc) * 100) / 100);
    }
  }, [customPrice, discountPct, discountMode, selPackage]);

  if (!open) return null;

  const filtStudents = allStudents.filter(s => (s.full_name ?? '').toLowerCase().includes(studentQ.toLowerCase()));
  const filtPackages = packages.filter(p => p.name.toLowerCase().includes(packageQ.toLowerCase()));

  const accentVar = 'var(--color-accent)';
  const basePrice  = selPackage ? Number(selPackage.price ?? 0) : 0;

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition focus:border-[color:var(--color-accent)]/70 focus:bg-slate-800/80'
    : 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]/60 focus:bg-white';

  const labelCls = `mb-1.5 block text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  const triggerCls = isDark
    ? 'flex w-full items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-left text-xs transition hover:border-slate-600'
    : 'flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-slate-300';

  const dropPanelCls = isDark
    ? 'absolute left-0 right-0 top-[calc(100%+3px)] z-[200] rounded-xl border border-slate-700/60 bg-[#0f1729] shadow-2xl'
    : 'absolute left-0 right-0 top-[calc(100%+3px)] z-[200] rounded-xl border border-slate-200 bg-white shadow-xl';

  const dropSearchInputCls = isDark
    ? 'w-full rounded-lg border border-slate-700/50 bg-slate-800/80 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 outline-none'
    : 'w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 outline-none';

  const dropRowCls = (active: boolean) => isDark
    ? `flex cursor-pointer items-center gap-3 px-3 py-2.5 text-xs transition ${active ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`
    : `flex cursor-pointer items-center gap-3 px-3 py-2.5 text-xs transition ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`;

  const scrollStyle: React.CSSProperties = {
    maxHeight: '180px', overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: isDark ? 'rgba(100,116,139,0.4) transparent' : 'rgba(203,213,225,0.8) transparent',
  };

  const cancelCls = isDark
    ? 'rounded-lg border border-slate-700/60 px-4 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const periodToggleCls = (active: boolean) => [
    'flex-1 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition',
    active
      ? `border-transparent ${isDark ? 'text-black' : 'text-white'}`
      : isDark
        ? 'border-slate-700/60 text-slate-500 hover:border-slate-600 hover:text-slate-300'
        : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
  ].join(' ');

  const discountTabCls = (active: boolean) => [
    'px-2.5 py-1 text-[10px] font-semibold rounded transition',
    active
      ? isDark ? 'bg-slate-700 text-slate-100' : 'bg-white text-slate-700 shadow-sm'
      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600',
  ].join(' ');

  const lockedRowCls = isDark
    ? 'flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2.5'
    : 'flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5';

  const lockedBadgeCls = isDark
    ? 'rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-700/60 text-slate-400'
    : 'rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={[
          'relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden',
          isDark ? 'border-slate-700/50' : 'border-slate-200 bg-white',
        ].join(' ')}
        style={isDark ? { background: 'var(--color-sidebar)' } : {}}
      >
        {/* ── Accent bar — inside overflow:hidden so corners clip cleanly ── */}
        <div className="h-[3px] w-full" style={{
          background: isRenew
            ? 'linear-gradient(90deg,#38bdf8,color-mix(in srgb,#38bdf8 15%,transparent))'
            : `linear-gradient(90deg,${accentVar},color-mix(in srgb,${accentVar} 15%,transparent))`,
        }} />

        {/*
          Dropdowns need overflow:visible — wrap body+footer in a separate div
          with overflow:visible while the card itself has overflow:hidden for the bar.
        */}
        <div style={{ overflow: 'visible' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{
                background: isRenew ? 'color-mix(in srgb,#38bdf8 12%,transparent)' : 'color-mix(in srgb,var(--color-accent) 12%,transparent)',
                border: isRenew ? '1px solid color-mix(in srgb,#38bdf8 25%,transparent)' : '1px solid color-mix(in srgb,var(--color-accent) 25%,transparent)',
              }}>
                {isRenew ? <RefreshCw className="h-3.5 w-3.5 text-sky-400" /> : <Package className="h-3.5 w-3.5" style={{ color: accentVar }} />}
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                  {isRenew ? 'Ανανέωση συνδρομής' : 'Ανάθεση πακέτου'}
                </h3>
                <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isRenew
                    ? `Ανανέωση για ${selStudent?.full_name ?? ''} — πακέτο, τιμή και νέα περίοδος.`
                    : 'Επίλεξε μαθητή, πακέτο, τιμή και περίοδο.'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className={isDark
                ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 text-slate-500 transition hover:border-slate-600 hover:text-slate-200'
                : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700'}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {assignError && (
            <div className="mx-6 mb-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-400">
              {assignError}
            </div>
          )}

          {/* Body */}
          <div className="px-6 pb-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              {/* Student */}
              <div className="col-span-2">
                <label className={labelCls}>Μαθητής *</label>
                {isRenew ? (
                  <div className={lockedRowCls}>
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{selStudent?.full_name}</span>
                    <span className={lockedBadgeCls}>κλειδωμένο</span>
                  </div>
                ) : (
                  <div className="relative">
                    <button type="button" className={triggerCls}
                      onClick={() => { setStudentDrop(v => !v); setPackageDrop(false); }}>
                      {selStudent
                        ? <span className={`flex-1 truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{selStudent.full_name}</span>
                        : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>Επίλεξε μαθητή…</span>}
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${studentDrop ? 'rotate-180' : ''} ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                    </button>
                    {studentDrop && (
                      <div className={dropPanelCls}>
                        <div className="px-3 pt-3 pb-2">
                          <div className="relative">
                            <Search className={`absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                            <input value={studentQ} onChange={e => setStudentQ(e.target.value)} placeholder="Αναζήτηση…" autoFocus className={dropSearchInputCls} />
                          </div>
                        </div>
                        <div style={scrollStyle}>
                          {filtStudents.length === 0
                            ? <p className={`px-3 py-3 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν βρέθηκαν.</p>
                            : filtStudents.map(s => (
                              <div key={s.id} className={dropRowCls(selStudent?.id === s.id)}
                                onClick={() => { onStudentSelect(s); setStudentDrop(false); setStudentQ(''); }}>
                                <span className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.full_name}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Package */}
              <div className="col-span-2">
                <label className={labelCls}>Πακέτο *</label>
                <div className="relative">
                  <button type="button" className={triggerCls}
                    onClick={() => { setPackageDrop(v => !v); setStudentDrop(false); }}>
                    {selPackage ? (
                      <>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColors(packageTypeFromName(selPackage.name), isDark).badge}`}>
                          {typeLabel(packageTypeFromName(selPackage.name))}
                        </span>
                        <span className={`flex-1 truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{selPackage.name}</span>
                        <span className={`shrink-0 tabular-nums text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{money(selPackage.price)} {CURRENCY_SYMBOL}</span>
                      </>
                    ) : (
                      <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>Επίλεξε πακέτο…</span>
                    )}
                    <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${packageDrop ? 'rotate-180' : ''} ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                  </button>
                  {packageDrop && (
                    <div className={dropPanelCls}>
                      <div className="px-3 pt-3 pb-2">
                        <div className="relative">
                          <Search className={`absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                          <input value={packageQ} onChange={e => setPackageQ(e.target.value)} placeholder="Αναζήτηση…" autoFocus className={dropSearchInputCls} />
                        </div>
                      </div>
                      <div style={scrollStyle}>
                        {filtPackages.length === 0
                          ? <p className={`px-3 py-3 text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν βρέθηκαν.</p>
                          : filtPackages.map(pkg => {
                            const pt = packageTypeFromName(pkg.name);
                            return (
                              <div key={pkg.id} className={dropRowCls(selPackage?.id === pkg.id)}
                                onClick={() => { onPackageSelect(pkg); setPackageDrop(false); }}>
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColors(pt, isDark).badge}`}>
                                  {typeLabel(pt)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{pkg.name}</p>
                                  {pkg.hours && <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{pkg.hours} ώρες</p>}
                                </div>
                                <span className={`shrink-0 tabular-nums text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {money(pkg.price)} {CURRENCY_SYMBOL}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className={labelCls}>Τιμολόγηση</label>

                {/* Base price */}
                <div className={`mb-2 flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Βασική τιμή</span>
                  <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {selPackage ? `${money(basePrice)} ${CURRENCY_SYMBOL}` : '—'}
                  </span>
                </div>

                {/* Discount box */}
                <div className={`rounded-lg border ${isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
                  {/* Mode toggle */}
                  <div className={`flex items-center border-b px-2 py-1.5 ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                    <span className={`mr-auto text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Έκπτωση</span>
                    <div className={`flex rounded p-0.5 ${isDark ? 'bg-slate-900/60' : 'bg-slate-200/60'}`}>
                      <button
                        type="button"
                        className={discountTabCls(discountMode === 'pct')}
                        onClick={() => { setDiscountMode('pct'); setDiscountPct(''); }}>
                        %
                      </button>
                      <button
                        type="button"
                        className={discountTabCls(discountMode === 'amount')}
                        onClick={() => { setDiscountMode('amount'); setDiscountPct(''); }}>
                        €
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <input
                      value={discountPct}
                      onChange={e => setDiscountPct(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                      disabled={!selPackage}
                      inputMode="decimal"
                      placeholder={discountMode === 'pct' ? 'π.χ. 10  (%)' : 'π.χ. 5.00  (€)'}
                      className={`w-full ${inputCls} ${!selPackage ? 'cursor-not-allowed opacity-40' : ''}`}
                    />
                  </div>
                </div>

                {/* Final price — uses localFinalPrice which respects discountMode */}
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Τελική τιμή</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: accentVar }}>
                    {selPackage ? `${money(localFinalPrice)} ${CURRENCY_SYMBOL}` : '—'}
                  </span>
                </div>
              </div>

              {/* Period */}
              <div>
                {selPackage ? (
                  <>
                    <label className={labelCls}>Περίοδος</label>

                    {/* Hourly */}
                    {isHourlyPackageName(selPackage.name) && (
                      <div>
                        <AppDatePicker value={assignStartsOn} onChange={setAssignStartsOn} />
                        <p className={`mt-1.5 text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Ωριαίο — χωρίς ημ. λήξης.</p>
                      </div>
                    )}

                    {/* Monthly */}
                    {isMonthlyPackageName(selPackage.name) && (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          {(['month', 'range'] as PeriodMode[]).map(m => (
                            <button key={m} type="button" onClick={() => setAssignPeriodMode(m)}
                              className={periodToggleCls(assignPeriodMode === m)}
                              style={assignPeriodMode === m ? { background: isDark ? accentVar : '#2563eb' } : {}}>
                              {m === 'month' ? 'Ανά μήνα' : 'Εύρος ημ/νιών'}
                            </button>
                          ))}
                        </div>
                        {assignPeriodMode === 'month' ? (
                          <div className="flex gap-2">
                            <select value={assignMonthNum} onChange={e => setAssignMonthNum(e.target.value)} className={`flex-1 ${inputCls}`}>
                              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <select value={assignYear} onChange={e => setAssignYear(e.target.value)} className={`w-20 ${inputCls}`}>
                              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <AppDatePicker value={assignStartsOn} onChange={setAssignStartsOn} />
                            <AppDatePicker value={assignEndsOn} onChange={setAssignEndsOn} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Yearly — locked */}
                    {isYearlyPackageName(selPackage.name) && (
                      <div>
                        {assignStartsOn && assignEndsOn ? (
                          <div className={lockedRowCls}>
                            <div className="flex items-center gap-2">
                              <CalendarDays className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-amber-400/70' : 'text-amber-500'}`} />
                              <span className={`text-xs font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                {assignStartsOn} – {assignEndsOn}
                              </span>
                            </div>
                            <span className={lockedBadgeCls}>κλειδωμένο</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[11px] ${isDark ? 'border-amber-500/30 text-amber-400/60' : 'border-amber-300 text-amber-600/70'}`}>
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            Δεν έχει οριστεί διάστημα — πήγαινε στα Πακέτα Συνδρομών.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Period summary (non-yearly) */}
                    {!isYearlyPackageName(selPackage.name) && assignPeriodDisplay() && (
                      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ${isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        <CalendarDays className="h-3 w-3 opacity-50" />
                        {assignPeriodDisplay()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`flex h-full items-center justify-center rounded-lg border border-dashed py-6 text-[11px] ${isDark ? 'border-slate-700/50 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                    Επίλεξε πακέτο πρώτα
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className={`mt-4 flex justify-end gap-2 px-6 py-4 ${isDark ? 'border-t border-slate-800/60' : 'border-t border-slate-100 bg-slate-50/60'}`}>
            <button type="button" onClick={onClose} className={cancelCls}>Ακύρωση</button>
            <button type="button" onClick={onSubmit} disabled={saving}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50 ${isDark ? 'text-black' : 'text-white'}`}
              style={{ background: isDark ? accentVar : '#2563eb' }}>
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : isRenew ? <RefreshCw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {isRenew ? 'Ανανέωση' : 'Ανάθεση'}
            </button>
          </div>

        </div>{/* end overflow:visible wrapper */}
      </div>
    </div>
  );
}