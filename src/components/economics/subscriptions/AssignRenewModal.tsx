import { CalendarDays, ChevronDown, Loader2, Package, Plus, RefreshCw, Search, X } from 'lucide-react';
import YearlySubscriptionModal from './YearlySubscriptionModal';
import MonthlySubscriptionModal from './MonthlySubscriptionModal';
import { typeColors } from './constants';
import { TypeIcon } from './TypeIcon';
import { CURRENCY_SYMBOL } from './constants';
import { isoToDisplayDate, isHourlyPackageName, isMonthlyPackageName, isYearlyPackageName, money, monthKeyToRange, packageTypeFromName, typeLabel } from './utils';
import type { PackageRow, PeriodMode, StudentRow, SubModal } from './types';

interface Props {
  open: boolean;
  isRenew: boolean;
  saving: boolean;
  assignError: string | null;
  isDark: boolean;
  // Student
  selStudent: StudentRow | null;
  allStudents: StudentRow[];
  studentQ: string;
  setStudentQ: (v: string) => void;
  studentDrop: boolean;
  setStudentDrop: (v: boolean | ((p: boolean) => boolean)) => void;
  onStudentSelect: (s: StudentRow) => void;
  // Package
  selPackage: PackageRow | null;
  packages: PackageRow[];
  packageQ: string;
  setPackageQ: (v: string) => void;
  packageDrop: boolean;
  setPackageDrop: (v: boolean | ((p: boolean) => boolean)) => void;
  onPackageSelect: (p: PackageRow) => void;
  // Pricing
  customPrice: string;
  setCustomPrice: (v: string) => void;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  assignFinalPrice: number;
  // Period
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
  // Sub-modals
  yearlyModal: SubModal | null;
  setYearlyModal: (v: SubModal | null) => void;
  monthlyModal: SubModal | null;
  setMonthlyModal: (v: SubModal | null) => void;
  packageById: Map<string, PackageRow>;
  setSelPackage: (p: PackageRow | null) => void;
  setAssignPeriodModeRaw: (m: PeriodMode) => void;
  // Actions
  onClose: () => void;
  onSubmit: () => void;
}

export function AssignRenewModal({
  open, isRenew, saving, assignError, isDark,
  selStudent, allStudents, studentQ, setStudentQ, studentDrop, setStudentDrop, onStudentSelect,
  selPackage, packages, packageQ, setPackageQ, packageDrop, setPackageDrop, onPackageSelect,
  customPrice, setCustomPrice, discountPct, setDiscountPct, assignFinalPrice,
  assignPeriodMode, setAssignPeriodMode, assignMonthNum, setAssignMonthNum, assignYear, setAssignYear,
  assignStartsOn, setAssignStartsOn, assignEndsOn, setAssignEndsOn,
  monthOptions, yearOptions, assignPeriodDisplay,
  yearlyModal, setYearlyModal, monthlyModal, setMonthlyModal, packageById, setSelPackage, setAssignPeriodModeRaw,
  onClose, onSubmit,
}: Props) {
  if (!open) return null;

  const filtStudents = allStudents.filter(s => (s.full_name ?? '').toLowerCase().includes(studentQ.toLowerCase()));
  const filtPackages = packages.filter(p => p.name.toLowerCase().includes(packageQ.toLowerCase()));

  const inputCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
    : 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20';

  const labelCls = `block mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  const cancelBtnCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition'
    : 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const dropdownCls = isDark
    ? 'absolute z-[60] mt-1 w-full rounded-xl border border-slate-700/70 bg-slate-900 shadow-2xl overflow-hidden'
    : 'absolute z-[60] mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden';

  const dropItemCls = (sel: boolean) => isDark
    ? `flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition ${sel ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/70'}`
    : `flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs transition ${sel ? 'bg-slate-100 text-slate-800' : 'text-slate-700 hover:bg-slate-50'}`;

  const assignModalCls = isDark
    ? 'relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl';

  const monthLabel = (m: string) => monthOptions.find(x => x.value === m)?.label ?? '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
        <div className={assignModalCls} style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
          {/* Accent bar */}
          <div className="h-0.5 w-full" style={{ background: isRenew ? 'linear-gradient(90deg,#38bdf8,color-mix(in srgb,#38bdf8 30%,transparent))' : 'linear-gradient(90deg,var(--color-accent),color-mix(in srgb,var(--color-accent) 30%,transparent))' }} />

          {/* Header */}
          <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${!isDark ? 'border-b border-slate-100' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={isRenew ? { background: 'color-mix(in srgb,#38bdf8 15%,transparent)', border: '1px solid color-mix(in srgb,#38bdf8 30%,transparent)' } : { background: 'color-mix(in srgb,var(--color-accent) 15%,transparent)', border: '1px solid color-mix(in srgb,var(--color-accent) 30%,transparent)' }}>
                {isRenew ? <RefreshCw className="h-4 w-4 text-sky-400" /> : <Package className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{isRenew ? 'Ανανέωση συνδρομής' : 'Ανάθεση πακέτου'}</h3>
                <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isRenew ? `Ανανέωση για ${selStudent?.full_name ?? ''} — επίλεξε πακέτο, τιμή και νέα περίοδο.` : 'Επίλεξε μαθητή, πακέτο, τιμή και περίοδο.'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={modalCloseBtnCls}><X className="h-3.5 w-3.5" /></button>
          </div>

          {assignError && <div className="mx-6 mb-3 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">{assignError}</div>}

          {/* 2-column body */}
          <div className="px-6 pb-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">

              {/* Step 1: Student */}
              <div className="col-span-2">
                <label className={labelCls}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-input-bg)' }}>1</span>
                  Μαθητής *
                </label>
                {isRenew ? (
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`flex-1 text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{selStudent?.full_name}</span>
                    <span className={`text-[10px] rounded-full border px-1.5 py-0.5 ${isDark ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-sky-200 bg-sky-50 text-sky-600'}`}>Κλειδωμένο</span>
                  </div>
                ) : (
                  <div className="relative">
                    <button type="button" onClick={() => { setStudentDrop(v => !v); setPackageDrop(false); }}
                      className={`w-full flex items-center gap-2 ${inputCls} text-left`}>
                      {selStudent
                        ? <span className="flex-1 truncate">{selStudent.full_name}</span>
                        : <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Επίλεξε μαθητή…</span>}
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${studentDrop ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                    {studentDrop && (
                      <div className={dropdownCls}>
                        <div className={`px-2 pt-2 pb-1 ${isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'}`}>
                          <div className="relative">
                            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                            <input value={studentQ} onChange={e => setStudentQ(e.target.value)} placeholder="Αναζήτηση…" autoFocus
                              className={`w-full rounded-md border py-1.5 pl-6 pr-2 text-xs outline-none ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-200 placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400'}`} />
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto ss-thin">
                          {filtStudents.length === 0 && <p className={`px-3 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν.</p>}
                          {filtStudents.map(s => (
                            <div key={s.id} className={dropItemCls(selStudent?.id === s.id)} onClick={() => { onStudentSelect(s); setStudentDrop(false); setStudentQ(''); }}>
                              <span className="truncate font-medium">{s.full_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Package */}
              <div className="col-span-2">
                <label className={labelCls}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-input-bg)' }}>2</span>
                  Πακέτο *
                </label>
                <div className="relative">
                  <button type="button" onClick={() => { setPackageDrop(v => !v); setStudentDrop(false); }}
                    className={`w-full flex items-center gap-2 ${inputCls} text-left`}>
                    {selPackage ? (
                      <>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeColors(packageTypeFromName(selPackage.name), isDark).badge}`}>
                          <TypeIcon type={packageTypeFromName(selPackage.name)} className={`h-2.5 w-2.5 ${typeColors(packageTypeFromName(selPackage.name), isDark).icon}`} />
                          {typeLabel(packageTypeFromName(selPackage.name))}
                        </span>
                        <span className="flex-1 truncate">{selPackage.name}</span>
                        <span className={`text-xs tabular-nums shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{money(selPackage.price)} {CURRENCY_SYMBOL}</span>
                      </>
                    ) : (
                      <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Επίλεξε πακέτο…</span>
                    )}
                    <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${packageDrop ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>
                  {packageDrop && (
                    <div className={dropdownCls}>
                      <div className={`px-2 pt-2 pb-1 ${isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'}`}>
                        <div className="relative">
                          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                          <input value={packageQ} onChange={e => setPackageQ(e.target.value)} placeholder="Αναζήτηση…" autoFocus
                            className={`w-full rounded-md border py-1.5 pl-6 pr-2 text-xs outline-none ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-200 placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400'}`} />
                        </div>
                      </div>
                      <div className="max-h-40 overflow-y-auto ss-thin">
                        {filtPackages.length === 0 && <p className={`px-3 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν.</p>}
                        {filtPackages.map(p => {
                          const pt = packageTypeFromName(p.name);
                          return (
                            <div key={p.id} className={dropItemCls(selPackage?.id === p.id)} onClick={() => onPackageSelect(p)}>
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeColors(pt, isDark).badge}`}>
                                <TypeIcon type={pt} className={`h-2.5 w-2.5 ${typeColors(pt, isDark).icon}`} />{typeLabel(pt)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{p.name}</p>
                                {p.hours && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.hours} ώρες</p>}
                              </div>
                              <span className={`text-[11px] tabular-nums font-semibold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{money(p.price)} {CURRENCY_SYMBOL}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Pricing */}
              <div>
                <label className={labelCls}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-input-bg)' }}>3</span>
                  Τιμολόγηση
                </label>
                <div className="flex gap-2">
                  <input value={customPrice} onChange={e => setCustomPrice(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                    disabled={!selPackage} inputMode="decimal"
                    placeholder={selPackage ? `Τιμή (${money(selPackage.price)} ${CURRENCY_SYMBOL})` : 'Τιμή'}
                    className={`flex-1 ${inputCls} ${!selPackage ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  <input value={discountPct} onChange={e => setDiscountPct(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                    disabled={!selPackage} inputMode="decimal" placeholder="Έκπτωση %"
                    className={`w-24 ${inputCls} ${!selPackage ? 'opacity-50 cursor-not-allowed' : ''}`} />
                </div>
                <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Τελική: <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{selPackage ? `${money(assignFinalPrice)} ${CURRENCY_SYMBOL}` : '—'}</span>
                </p>
              </div>

              {/* Step 4: Period */}
              <div>
                {selPackage && (
                  <>
                    <label className={labelCls}>
                      <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: 'var(--color-accent)', color: 'var(--color-input-bg)' }}>4</span>
                      Περίοδος
                    </label>

                    {isHourlyPackageName(selPackage.name) && (
                      <div>
                        <input type="text" value={assignStartsOn} onChange={e => setAssignStartsOn(e.target.value)} placeholder="ΗΗ/ΜΜ/ΕΕΕΕ" className={`w-full ${inputCls}`} />
                        <p className={`mt-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ωριαίο — χωρίς ημ. λήξης.</p>
                      </div>
                    )}

                    {isMonthlyPackageName(selPackage.name) && (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          {(['month', 'range'] as PeriodMode[]).map(m => (
                            <button key={m} type="button" onClick={() => setAssignPeriodMode(m)}
                              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${assignPeriodMode === m ? 'border-transparent text-white' : isDark ? 'border-slate-700/60 text-slate-400 hover:bg-slate-800/40' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                              style={assignPeriodMode === m ? { background: 'var(--color-accent)' } : {}}>
                              {m === 'month' ? 'Ανά μήνα' : 'Εύρος'}
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
                          <div className="flex gap-2">
                            <input value={assignStartsOn} onChange={e => setAssignStartsOn(e.target.value)} placeholder="Έναρξη" className={`flex-1 ${inputCls}`} />
                            <input value={assignEndsOn} onChange={e => setAssignEndsOn(e.target.value)} placeholder="Λήξη" className={`flex-1 ${inputCls}`} />
                          </div>
                        )}
                      </div>
                    )}

                    {isYearlyPackageName(selPackage.name) && (
                      <div className="flex gap-2">
                        <input value={assignStartsOn} onChange={e => setAssignStartsOn(e.target.value)} placeholder="Έναρξη ΗΗ/ΜΜ/ΕΕΕΕ" className={`flex-1 ${inputCls}`} />
                        <input value={assignEndsOn} onChange={e => setAssignEndsOn(e.target.value)} placeholder="Λήξη ΗΗ/ΜΜ/ΕΕΕΕ" className={`flex-1 ${inputCls}`} />
                      </div>
                    )}

                    {assignPeriodDisplay() && (
                      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        <CalendarDays className="h-3 w-3 opacity-60" />{assignPeriodDisplay()}
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-end gap-2.5 px-6 py-4 mt-3 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
            <button type="button" onClick={onClose} className={cancelBtnCls}>Ακύρωση</button>
            <button type="button" onClick={onSubmit} disabled={saving}
              className="btn-primary gap-2 px-5 py-2 font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRenew ? <RefreshCw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {isRenew ? 'Ανανέωση' : 'Ανάθεση'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <YearlySubscriptionModal
        open={!!yearlyModal} studentName={selStudent?.full_name ?? ''} packageName={yearlyModal?.pkgName ?? ''}
        initialStart={assignStartsOn} initialEnd={assignEndsOn}
        onCancel={() => { if (yearlyModal) setSelPackage(yearlyModal.prevPkgId ? packageById.get(yearlyModal.prevPkgId) ?? null : null); setYearlyModal(null); }}
        onSave={(s, e) => { setAssignStartsOn(s); setAssignEndsOn(e); setAssignPeriodModeRaw('range'); setYearlyModal(null); }}
      />
      <MonthlySubscriptionModal
        open={!!monthlyModal} studentName={selStudent?.full_name ?? ''} packageName={monthlyModal?.pkgName ?? ''}
        yearOptions={yearOptions} monthOptions={monthOptions}
        initialMode={assignPeriodMode} initialMonth={assignMonthNum} initialYear={assignYear}
        initialStart={assignStartsOn} initialEnd={assignEndsOn}
        onCancel={() => { if (monthlyModal) setSelPackage(monthlyModal.prevPkgId ? packageById.get(monthlyModal.prevPkgId) ?? null : null); setMonthlyModal(null); }}
        onSave={({ mode, month, year, startDisplay, endDisplay }) => {
          setAssignPeriodModeRaw(mode);
          if (mode === 'month') {
            setAssignMonthNum(month); setAssignYear(year);
            const r = monthKeyToRange(`${year}-${month}`);
            if (r) { setAssignStartsOn(isoToDisplayDate(r.startISO)); setAssignEndsOn(isoToDisplayDate(r.endISO)); }
          } else {
            setAssignStartsOn(startDisplay); setAssignEndsOn(endDisplay);
          }
          setMonthlyModal(null);
        }}
      />
    </>
  );
}
