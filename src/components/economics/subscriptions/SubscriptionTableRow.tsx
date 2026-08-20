import { AlertCircle, CalendarDays, CheckCircle2, IdCard, RefreshCw, Tag, Trash2, XCircle } from 'lucide-react';
import { CURRENCY_SYMBOL, typeColors } from './constants';
import { TypeIcon } from './TypeIcon';
import { formatMonthRangeGreek, money, packageTypeFromName, periodSummary, resolvePackageType } from './utils';
import type { PackageRow, StudentViewRow } from './types';

interface Props {
  row: StudentViewRow;
  rowNumber: number;
  isDark: boolean;
  packageById: Map<string, PackageRow>;
  onGoToStudent: (row: StudentViewRow) => void;
  onRenew: (row: StudentViewRow) => void;
  onDelete: (row: StudentViewRow) => void;
}

export function SubscriptionTableRow({ row, rowNumber, isDark, packageById, onGoToStudent, onRenew, onDelete }: Props) {
  const sub        = row.sub!;
  const pkgName    = sub.package_name ?? '';
  const pkg        = sub.package_id ? packageById.get(sub.package_id) : undefined;
  const isCustom   = !!(pkg?.is_custom && pkg?.avatar_color);
  const pkgType    = packageTypeFromName(pkgName);
  const colors     = typeColors(pkgType, isDark);
  const paid       = row.paid;
  const billed     = Number((sub as any).charge_amount ?? sub.price ?? 0);
  const balance    = Number(row.balance ?? 0);
  const dispPrice  = Number(sub.price ?? billed);
  const effectiveEndsOn = sub.ends_on ?? (isCustom ? (pkg?.ends_on ?? null) : null);
  const isExpired  = effectiveEndsOn ? new Date(effectiveEndsOn) < new Date() : false;
  // Monthly plans auto-charge every month, so manual renewal is retired for them.
  const resolvedType = pkg ? resolvePackageType(pkg) : pkgType;
  const canRenew   = resolvedType !== 'monthly';

  const paidCls    = paid > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-400');
  const balanceCls = balance > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600');

  const badge = paid <= 0 && billed > 0
    ? { text: 'Ανεξόφλητο', cls: isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-300 bg-red-50 text-red-600', icon: <XCircle className="h-3 w-3" /> }
    : balance > 0
    ? { text: 'Υπόλοιπο',   cls: isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-600', icon: <AlertCircle className="h-3 w-3" /> }
    : { text: 'Εξοφλημένο', cls: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> };

  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';

  return (
    <tr key={`${row.student_id}-${sub.id}`} className={isDark ? 'transition-colors hover:bg-slate-900/40' : 'transition-colors hover:bg-slate-50/80'}>

      <td className={`whitespace-nowrap px-4 py-3 align-middle tabular-nums ${colDivider} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{rowNumber}</td>

      {/* Student */}
      <td className={`px-4 py-3 align-middle ${colDivider}`}>
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
      <td className={`px-4 py-3 align-middle ${colDivider}`}>
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
      <td className={`px-4 py-3 align-middle ${colDivider}`}>
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${isExpired ? (isDark ? 'text-rose-400' : 'text-rose-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
          <CalendarDays className="h-3 w-3 opacity-50 shrink-0" />
          {row.planRange ? formatMonthRangeGreek(row.planRange.start_month, row.planRange.end_month) : periodSummary(sub)}
        </span>
      </td>

      <td className={`px-4 py-3 align-middle text-right ${colDivider}`}>
        <span className={`text-[12px] tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {money(dispPrice)} {CURRENCY_SYMBOL}
        </span>
        {sub.discount_reason && (
          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Tag className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate max-w-[120px]">{sub.discount_reason}</span>
          </div>
        )}
      </td>
      <td className={`px-4 py-3 align-middle text-right text-[12px] tabular-nums font-medium ${colDivider} ${paidCls}`}>
        {money(paid)} {CURRENCY_SYMBOL}
      </td>
      <td className={`px-4 py-3 align-middle text-right text-[12px] tabular-nums font-medium ${colDivider} ${balanceCls}`}>
        {money(balance)} {CURRENCY_SYMBOL}
      </td>

      {/* Status badge */}
      <td className={`px-4 py-3 align-middle ${colDivider}`}>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.cls}`}>
          {badge.icon}{badge.text}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 align-middle">
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
            style={{ background: 'var(--color-accent)', color: 'var(--ch-icon)' }}>
            <IdCard className="h-3.5 w-3.5" />
            Καρτέλα μαθητή
          </button>
          <button type="button" onClick={() => onDelete(row)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
            title="Διαγραφή">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
