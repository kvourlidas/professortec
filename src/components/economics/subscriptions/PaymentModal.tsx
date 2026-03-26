import { HandCoins, Loader2, X } from 'lucide-react';
import { CURRENCY_SYMBOL, typeColors } from './constants';
import { TypeIcon } from './TypeIcon';
import { formatDateTime, isHourlyPackageName, money, packageTypeFromName, typeLabel } from './utils';
import type { StudentViewRow } from './types';

interface Props {
  row: StudentViewRow | null;
  paymentInput: string;
  payingLoading: boolean;
  pmPaid: number;
  pmBilled: number;
  pmBalance: number;
  pmHistoryTotal: number;
  isDark: boolean;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function PaymentModal({
  row, paymentInput, payingLoading, pmPaid, pmBilled, pmBalance, pmHistoryTotal,
  isDark, onInputChange, onSubmit, onClose,
}: Props) {
  if (!row) return null;

  const sub       = row.sub!;
  const pkgType   = packageTypeFromName(sub.package_name);
  const colors    = typeColors(pkgType, isDark);
  const isHourly  = isHourlyPackageName(sub.package_name);
  const dispPrice = isHourly ? Number(sub.price ?? 0) : pmBilled;

  const inputCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
    : 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20';

  const cancelBtnCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition'
    : 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700/60' : 'border-slate-200 bg-white'}`}
        style={isDark ? { background: 'var(--color-sidebar)' } : {}}
      >
        {/* Accent bar */}
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg,var(--color-accent),color-mix(in srgb,var(--color-accent) 30%,transparent))' }} />

        {/* Header */}
        <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${isDark ? 'border-b border-slate-800/60' : 'border-b border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb,var(--color-accent) 15%,transparent)', border: '1px solid color-mix(in srgb,var(--color-accent) 30%,transparent)' }}>
              <HandCoins className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <div className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Πληρωμή συνδρομής</div>
              <div className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Μαθητής: <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{row.student_name}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className={modalCloseBtnCls}><X className="h-3.5 w-3.5" /></button>
        </div>

        {/* 2-col body */}
        <div className="grid grid-cols-2 divide-x divide-slate-800/40 min-h-[280px]">

          {/* LEFT: summary + input */}
          <div className="flex flex-col gap-4 p-6">
            <div>
              <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πακέτο</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colors.badge}`}>
                  <TypeIcon type={pkgType} className={`h-3 w-3 ${colors.icon}`} />
                  {typeLabel(pkgType)}
                </span>
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{sub.package_name}</span>
              </div>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-2 rounded-xl border p-3 ${isDark ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-center">
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Χρέωση</p>
                <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{money(dispPrice)} {CURRENCY_SYMBOL}{isHourly ? ' /ώρα' : ''}</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πληρώθηκε</p>
                <p className={`text-sm font-bold tabular-nums ${pmPaid > 0 ? 'text-emerald-400' : (isDark ? 'text-slate-400' : 'text-slate-400')}`}>{money(pmPaid)} {CURRENCY_SYMBOL}</p>
              </div>
              <div className="text-center">
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Υπόλοιπο</p>
                <p className={`text-sm font-bold tabular-nums ${pmBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(pmBalance)} {CURRENCY_SYMBOL}</p>
              </div>
            </div>

            {/* Payment input */}
            <div className="mt-auto">
              <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ποσό πληρωμής</p>
              <div className="flex gap-2">
                <input
                  value={paymentInput}
                  onChange={e => onInputChange(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  disabled={payingLoading}
                  inputMode="decimal"
                  placeholder={`π.χ. ${money(pmBalance)}`}
                  className={`flex-1 ${inputCls} ${payingLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
                />
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={payingLoading}
                  className="btn-primary gap-1.5 px-4 py-2 disabled:opacity-60"
                >
                  {payingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                  Καταχώρηση
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: payment history */}
          <div className="flex flex-col p-6">
            <p className={`mb-3 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ιστορικό πληρωμών</p>
            {row.payments.length === 0 ? (
              <div className={`flex flex-1 items-center justify-center rounded-xl border px-4 py-8 text-center text-xs ${isDark ? 'border-slate-700/50 bg-slate-900/30 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                Δεν υπάρχουν πληρωμές ακόμα.
              </div>
            ) : (
              <>
                <div className={`flex-1 overflow-hidden rounded-xl border ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                  <div className="max-h-52 overflow-y-auto ss-thin">
                    <table className="min-w-full border-collapse text-xs">
                      <thead className="sticky top-0">
                        <tr
                          className={`${isDark ? 'border-b border-slate-700/60 bg-slate-900/60' : 'border-b border-slate-200 bg-slate-50'} text-[10px] font-semibold uppercase tracking-widest`}
                          style={{ color: 'color-mix(in srgb,var(--color-accent) 70%,white)' }}
                        >
                          <th className="px-3 py-2.5 text-left">Ημερομηνία</th>
                          <th className="px-3 py-2.5 text-right">Ποσό</th>
                        </tr>
                      </thead>
                      <tbody className={isDark ? 'divide-y divide-slate-800/40' : 'divide-y divide-slate-100'}>
                        {row.payments.map((p, i) => (
                          <tr key={`${p.created_at ?? 'na'}-${i}`} className={isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}>
                            {/* Fix: created_at is string | null | undefined — coerce to string | null */}
                            <td className={`px-3 py-2.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {formatDateTime(p.created_at ?? null)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-400">
                              {money(p.amount)} {CURRENCY_SYMBOL}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={`mt-2.5 flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Σύνολο πληρωμών</span>
                  <span className="font-bold tabular-nums text-emerald-400">{money(pmHistoryTotal)} {CURRENCY_SYMBOL}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end px-6 py-3 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
          <button type="button" onClick={onClose} className={cancelBtnCls}>Κλείσιμο</button>
        </div>
      </div>
    </div>
  );
}