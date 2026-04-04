import { AlertCircle, CalendarDays, CheckCircle2, HandCoins, RefreshCw, Tag, Trash2, XCircle } from 'lucide-react';
import { CURRENCY_SYMBOL, typeColors } from './constants';
import { TypeIcon } from './TypeIcon';
import { isHourlyPackageName, money, packageTypeFromName, periodSummary } from './utils';
import type { PackageRow, StudentViewRow } from './types';

interface Props {
  row: StudentViewRow;
  isDark: boolean;
  packageById: Map<string, PackageRow>;
  onPayment: (row: StudentViewRow) => void;
  onRenew: (row: StudentViewRow) => void;
  onDelete: (row: StudentViewRow) => void;
}

export function SubscriptionTableRow({ row, isDark, packageById, onPayment, onRenew, onDelete }: Props) {
  const sub        = row.sub!;
  const pkgName    = sub.package_name ?? '';
  const pkg        = sub.package_id ? packageById.get(sub.package_id) : undefined;
  const isCustom   = !!(pkg?.is_custom && pkg?.avatar_color);
  const isHourly   = isHourlyPackageName(pkgName);
  const pkgType    = packageTypeFromName(pkgName);
  const colors     = typeColors(pkgType, isDark);
  const paid       = row.paid;
  const billedRaw  = Number((sub as any).charge_amount ?? sub.price ?? 0);
  const billed     = isHourly ? Math.abs(billedRaw) : billedRaw;
  const balance    = isHourly ? Math.max(0, billed - paid) : Number(row.balance ?? 0);
  const dispPrice  = isHourly ? Number(sub.price ?? 0) : Number(sub.price ?? billed);
  const effectiveEndsOn = sub.ends_on ?? (isCustom ? (pkg?.ends_on ?? null) : null);
  const dateExpired  = effectiveEndsOn ? new Date(effectiveEndsOn) < new Date() : false;
  const hoursExpired = isCustom && pkg?.hours != null && Number(sub.used_hours ?? 0) >= pkg.hours;
  const isExpired    = dateExpired || hoursExpired;

  const paidCls    = paid > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-400');
  const balanceCls = balance > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600');

  const badge = paid <= 0 && billed > 0
    ? { text: 'Ανεξόφλητο', cls: isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-300 bg-red-50 text-red-600', icon: <XCircle className="h-3 w-3" /> }
    : balance > 0
    ? { text: 'Υπόλοιπο',   cls: isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-600', icon: <AlertCircle className="h-3 w-3" /> }
    : { text: 'Εξοφλημένο', cls: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> };

  return (
    <tr key={`${row.student_id}-${sub.id}`} className={isDark ? 'transition-colors hover:bg-white/[0.025]' : 'transition-colors hover:bg-slate-50/80'}>

      {/* Student */}
      <td className="px-4 py-3 align-middle">
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
      <td className="px-4 py-3 align-middle">
        {isCustom ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${pkg!.avatar_color}22`, borderColor: `${pkg!.avatar_color}55`, color: pkg!.avatar_color }}
          >
            {pkgName || '?'}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colors.badge}`}>
            <TypeIcon type={pkgType} className={`h-3 w-3 ${colors.icon}`} />
            {pkgType === 'hourly' ? 'Ωριαίο' : pkgType === 'monthly' ? 'Μηνιαίο' : 'Ετήσιο'}
          </span>
        )}
      </td>

      {/* Period */}
      <td className="px-4 py-3 align-middle">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${isExpired ? (isDark ? 'border-rose-500/30 bg-rose-950/20 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-600') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600')}`}>
          <CalendarDays className="h-3 w-3 opacity-60" />
          {periodSummary(sub)}
        </span>
      </td>

      <td className="px-4 py-3 align-middle text-right">
        <span className={`text-[12px] tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {money(dispPrice)} {CURRENCY_SYMBOL}{isHourly ? ' / ώρα' : ''}
        </span>
        {sub.discount_reason && (
          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Tag className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate max-w-[120px]">{sub.discount_reason}</span>
          </div>
        )}
      </td>
      <td className={`px-4 py-3 align-middle text-right text-[12px] tabular-nums font-medium ${paidCls}`}>
        {money(paid)} {CURRENCY_SYMBOL}
      </td>
      <td className={`px-4 py-3 align-middle text-right text-[12px] tabular-nums font-medium ${balanceCls}`}>
        {money(balance)} {CURRENCY_SYMBOL}
      </td>

      {/* Status badge */}
      <td className="px-4 py-3 align-middle">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.cls}`}>
          {badge.icon}{badge.text}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          {isExpired && (
            <button type="button" onClick={() => onRenew(row)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-95 hover:shadow-[0_0_10px_rgba(56,189,248,0.45)] ${isDark ? 'border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' : 'border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
              title="Ανανέωση συνδρομής">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => onPayment(row)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(52,211,153,0.45)]"
            title="Πληρωμή / Ιστορικό">
            <HandCoins className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(row)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-400 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-500' : 'border-slate-200 bg-white text-slate-400'}`}
            title="Διαγραφή">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
