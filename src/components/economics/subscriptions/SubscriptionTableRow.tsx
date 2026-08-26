import { AlertCircle, Ban, CalendarDays, IdCard, RefreshCw, Tag } from 'lucide-react';
import { CURRENCY_SYMBOL, typeColors } from './constants';
import { TypeIcon } from './TypeIcon';
import { formatMonthRangeGreek, money, monthKeyList, packageTypeFromName, periodSummary, resolvePackageType, round2 } from './utils';
import type { PackageRow, StudentViewRow } from './types';

interface Props {
  row: StudentViewRow;
  rowNumber: number;
  isDark: boolean;
  packageById: Map<string, PackageRow>;
  onGoToStudent: (row: StudentViewRow) => void;
  onRenew: (row: StudentViewRow) => void;
  onCancel: (row: StudentViewRow) => void;
}

export function SubscriptionTableRow({ row, rowNumber, isDark, packageById, onGoToStudent, onRenew, onCancel }: Props) {
  const sub        = row.sub!;
  const pkgName    = sub.package_name ?? '';
  const pkg        = sub.package_id ? packageById.get(sub.package_id) : undefined;
  const isCustom   = !!(pkg?.is_custom && pkg?.avatar_color);
  const pkgType    = packageTypeFromName(pkgName);
  const colors     = typeColors(pkgType, isDark);

  // Price shown here is always the fixed starting price, never the accumulated
  // (monthly-growing) total — that only shows on the student's card page.
  let basePrice = Number(sub.price ?? 0);
  let discountAmount = 0;
  let discountLabel: string | null = null; // "10%" or "5.00 €", shown in its own unit
  let discountReasonText = sub.discount_reason ?? null;
  let partialMonths: { discounted: number; total: number } | null = null;

  if (row.plan) {
    basePrice = row.plan.monthly_price;
    discountReasonText = row.plan.discount_reason ?? null;
    if (row.plan.discount_mode === 'pct' && row.plan.discount_value > 0) {
      discountAmount = round2(basePrice * (row.plan.discount_value / 100));
      discountLabel = `${row.plan.discount_value}%`;
    } else if (row.plan.discount_mode === 'amount' && row.plan.discount_value > 0) {
      discountAmount = Math.min(basePrice, row.plan.discount_value);
      discountLabel = `${money(discountAmount)} ${CURRENCY_SYMBOL}`;
    }

    if (discountLabel && row.plan.discount_scope === 'months') {
      const totalMonths = monthKeyList(row.plan.start_month.slice(0, 7), row.plan.end_month.slice(0, 7)).length;
      const discountedMonths = row.plan.discount_months.length;
      if (discountedMonths > 0 && discountedMonths < totalMonths) partialMonths = { discounted: discountedMonths, total: totalMonths };
    }
  } else if (pkg && !isCustom) {
    const pkgBase = Number(pkg.price ?? 0);
    if (pkgBase > basePrice) {
      discountAmount = round2(pkgBase - basePrice);
      discountLabel = `${money(discountAmount)} ${CURRENCY_SYMBOL}`;
      basePrice = pkgBase;
    }
  }
  // Partial-month discounts don't apply to the whole plan, so the starting fee
  // stays as the headline number — only the discount itself is called out.
  const totalPrice = partialMonths ? basePrice : round2(Math.max(0, basePrice - discountAmount));

  // For monthly plans, also total up the full subscription (same per-month
  // logic the server uses to generate each month's charge).
  let planMonthCount = 0;
  let planTotal = 0;
  if (row.plan) {
    const plan = row.plan;
    const months = monthKeyList(plan.start_month.slice(0, 7), plan.end_month.slice(0, 7));
    planMonthCount = months.length;
    const hasDiscount = plan.discount_mode !== 'none' && plan.discount_value > 0;
    planTotal = round2(months.reduce((sum, key) => {
      const applies = hasDiscount && (plan.discount_scope === 'range' || plan.discount_months.includes(key));
      if (!applies) return sum + plan.monthly_price;
      const discounted = plan.discount_mode === 'pct'
        ? plan.monthly_price * (1 - plan.discount_value / 100)
        : Math.max(0, plan.monthly_price - plan.discount_value);
      return sum + discounted;
    }, 0));
  }

  const effectiveEndsOn = sub.ends_on ?? (isCustom ? (pkg?.ends_on ?? null) : null);
  const isExpired  = effectiveEndsOn ? new Date(effectiveEndsOn) < new Date() : false;
  // Monthly plans auto-charge every month, so manual renewal is retired for them.
  const resolvedType = pkg ? resolvePackageType(pkg) : pkgType;
  const canRenew   = resolvedType !== 'monthly';

  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';

  return (
    <tr key={`${row.student_id}-${sub.id}`} className={isDark ? 'transition-colors hover:bg-slate-900/40' : 'transition-colors hover:bg-slate-50/80'}>

      <td className={`whitespace-nowrap px-4 py-4 align-middle tabular-nums ${colDivider} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{rowNumber}</td>

      {/* Student */}
      <td className={`px-4 py-4 align-middle ${colDivider}`}>
        <div className="flex flex-col gap-0.5">
          <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{row.student_name}</span>
          {row.carriedDebt && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              <AlertCircle className="h-2.5 w-2.5 shrink-0" />
              Οφειλή {money(row.carriedDebt.amount)} € από «{row.carriedDebt.fromName}»
            </span>
          )}
        </div>
      </td>

      {/* Package badge */}
      <td className={`px-4 py-4 align-middle ${colDivider}`}>
        {isCustom ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${pkg!.avatar_color}22`, borderColor: `${pkg!.avatar_color}55`, color: pkg!.avatar_color ?? undefined }}
          >
            {pkgName || '?'}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colors.badge}`}>
            <TypeIcon type={pkgType} className={`h-3 w-3 ${colors.icon}`} />
            {pkgType === 'monthly' ? 'Μηνιαίο' : 'Ετήσιο'}
          </span>
        )}
      </td>

      {/* Period */}
      <td className={`px-4 py-4 align-middle ${colDivider}`}>
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${isExpired ? (isDark ? 'text-rose-400' : 'text-rose-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
          <CalendarDays className="h-3 w-3 opacity-50 shrink-0" />
          {row.planRange ? formatMonthRangeGreek(row.planRange.start_month, row.planRange.end_month) : periodSummary(sub)}
        </span>
      </td>

      <td className={`px-4 py-4 align-middle text-right ${colDivider}`}>
        {row.plan ? (
          <>
            {discountLabel && !partialMonths ? (
              <>
                <div className={`text-xs tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {money(basePrice)} {CURRENCY_SYMBOL} − {discountLabel}
                </div>
                <span className={`text-base font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {money(totalPrice)} {CURRENCY_SYMBOL}
                </span>
              </>
            ) : (
              <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {money(basePrice)} {CURRENCY_SYMBOL}
              </span>
            )}
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}> /μήνα</span>
            {partialMonths && discountLabel && (
              <div className={`mt-1 text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                − {discountLabel} ({partialMonths.discounted}/{partialMonths.total} μήνες)
              </div>
            )}
            {discountReasonText && (
              <div className={`mt-1 flex items-center justify-end gap-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[160px]">{discountReasonText}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {discountLabel && (
              <div className={`text-xs tabular-nums line-through ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {money(basePrice)} {CURRENCY_SYMBOL}
              </div>
            )}
            <span className={`text-base font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              {money(discountLabel ? totalPrice : basePrice)} {CURRENCY_SYMBOL}
            </span>
            {(discountLabel || discountReasonText) && (
              <div className={`mt-1 flex items-center justify-end gap-1.5 text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                <Tag className="h-3 w-3 shrink-0" />
                {discountLabel && <span className="shrink-0 tabular-nums">− {discountLabel}</span>}
                {discountReasonText && (
                  <span className="truncate max-w-[150px]">{discountLabel ? `· ${discountReasonText}` : discountReasonText}</span>
                )}
              </div>
            )}
          </>
        )}
        {row.plan && planMonthCount > 0 && (
          <div className={`mt-1.5 border-t pt-1.5 text-xs tabular-nums ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Σύνολο ({planMonthCount} {planMonthCount === 1 ? 'μήνας' : 'μήνες'}):{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{money(planTotal)} {CURRENCY_SYMBOL}</span>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          {isExpired && canRenew && (
            <button type="button" onClick={() => onRenew(row)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-95 ${isDark ? 'text-sky-400 hover:bg-sky-500/15' : 'text-sky-600 hover:bg-sky-100'}`}
              title="Ανανέωση συνδρομής">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => onGoToStudent(row)}
            title="Οι πληρωμές καταχωρούνται μόνο από την καρτέλα του μαθητή"
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition active:scale-95"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
            <IdCard className="h-3.5 w-3.5" />
            Καρτέλα μαθητή
          </button>
          <button type="button" onClick={() => onCancel(row)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
            title="Ακύρωση συνδρομής">
            <Ban className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
