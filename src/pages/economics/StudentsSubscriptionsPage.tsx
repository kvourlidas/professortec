import { AlertCircle, Briefcase, CheckCircle2, Plus, Search, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionsPage } from '../../components/economics/subscriptions/useSubscriptionsPage';
import { SubscriptionsTable } from '../../components/economics/subscriptions/SubscriptionsTable';
import { AssignRenewModal } from '../../components/economics/subscriptions/AssignRenewModal';
import { DeleteSubscriptionModal } from '../../components/economics/subscriptions/DeleteSubscriptionModal';
import type { StudentViewRow } from '../../components/economics/subscriptions/types';

type PayFilter = 'all' | 'settled' | 'owes' | 'unpaid';

const FILTER_OPTIONS: { key: PayFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all',     label: 'Όλες',         icon: <Briefcase className="h-3 w-3" /> },
  { key: 'settled', label: 'Εξοφλημένο',   icon: <CheckCircle2 className="h-3 w-3" /> },
  { key: 'owes',    label: 'Οφείλει',      icon: <AlertCircle className="h-3 w-3" /> },
  { key: 'unpaid',  label: 'Ανεξόφλητο',   icon: <XCircle className="h-3 w-3" /> },
];

export default function StudentsSubscriptionsPage() {
  const p = useSubscriptionsPage();
  const navigate = useNavigate();
  const goToStudent = (row: StudentViewRow) => navigate(`/students/${row.student_id}`);

  const searchInputCls = p.isDark
    ? 'h-9 w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  return (
    <>
      <div className="space-y-6 px-1">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-accent)' }}>
              <Briefcase className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h1 className={`text-base font-semibold tracking-tight ${p.isDark ? 'text-slate-50' : 'text-slate-800'}`}>Συνδρομές Μαθητών</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Payment filter */}
            <div className={`flex items-center gap-0.5 rounded-xl border p-1 ${p.isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
              {FILTER_OPTIONS.map(({ key, label, icon }) => {
                const active = p.payFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => p.setPayFilter(key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? p.isDark ? 'bg-slate-800 shadow-sm' : 'bg-white shadow-sm'
                        : p.isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    style={active ? { color: 'var(--color-accent)' } : undefined}
                  >
                    <span style={active ? { color: 'var(--color-accent)' } : undefined}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-48">
              <Search className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${p.isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input className={searchInputCls} placeholder="Αναζήτηση μαθητή..." value={p.search} onChange={e => p.setSearch(e.target.value)} />
            </div>
            <button type="button" onClick={p.openAssign} className="btn-primary shrink-0 gap-2 px-4 py-2">
              <Plus className="h-3.5 w-3.5" />Ανάθεση
            </button>
          </div>
        </div>

        {/* Feedback banner */}
        {(p.error || p.info) && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${p.error ? (p.isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-300 bg-red-50 text-red-700') : (p.isDark ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-700')}`}>
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${p.error ? 'bg-red-400' : 'bg-emerald-400'}`} />
            {p.error ?? p.info}
            <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => { p.setError(null); p.setInfo(null); }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Active subscriptions table */}
        <SubscriptionsTable
          variant="active"
          rows={p.rows}
          loading={p.loading}
          totalCount={p.totalCount}
          page={p.page}
          pageCount={p.pageCount}
          showingFrom={p.showingFrom}
          showingTo={p.showingTo}
          isDark={p.isDark}
          packageById={p.packageById}
          onPageChange={p.setPage}
          onOpenAssign={p.openAssign}
          onGoToStudent={goToStudent}
          onRenew={p.openRenew}
          onDelete={p.setDeleteTarget}
        />

        {/* Expired / renewed subscriptions table */}
        <SubscriptionsTable
          variant="expired"
          rows={p.expiredRows}
          loading={p.expiredLoading}
          totalCount={p.expiredTotalCount}
          page={p.expiredPage}
          pageCount={p.expiredPageCount}
          showingFrom={p.expiredShowingFrom}
          showingTo={p.expiredShowingTo}
          isDark={p.isDark}
          packageById={p.packageById}
          onPageChange={p.setExpiredPage}
          onOpenAssign={p.openAssign}
          onGoToStudent={goToStudent}
          onRenew={p.openRenew}
          onDelete={p.setDeleteTarget}
        />

        {/* Assign / Renew modal */}
        <AssignRenewModal
          open={p.assignOpen}
          isRenew={p.isRenew}
          saving={p.saving}
          assignError={p.assignError}
          isDark={p.isDark}
          selStudent={p.selStudent}
          allStudents={p.allStudents}
          studentQ={p.studentQ}
          setStudentQ={p.setStudentQ}
          studentDrop={p.studentDrop}
          setStudentDrop={p.setStudentDrop}
          onStudentSelect={p.setSelStudent}
          selPackage={p.selPackage}
          packages={p.packages}
          packageQ={p.packageQ}
          setPackageQ={p.setPackageQ}
          packageDrop={p.packageDrop}
          setPackageDrop={p.setPackageDrop}
          onPackageSelect={p.handlePackageSelect}
          customPrice={p.customPrice}
          setCustomPrice={p.setCustomPrice}
          discountPct={p.discountPct}
          setDiscountPct={p.setDiscountPct}
          discountMode={p.discountMode}
          setDiscountMode={p.setDiscountMode}
          discountReason={p.discountReason}
          setDiscountReason={p.setDiscountReason}
          assignFinalPrice={p.assignFinalPrice}
          assignMonthNum={p.assignMonthNum}
          setAssignMonthNum={p.setAssignMonthNum}
          assignYear={p.assignYear}
          setAssignYear={p.setAssignYear}
          assignEndMonthNum={p.assignEndMonthNum}
          setAssignEndMonthNum={p.setAssignEndMonthNum}
          assignEndYear={p.assignEndYear}
          setAssignEndYear={p.setAssignEndYear}
          discountScope={p.discountScope}
          setDiscountScope={p.setDiscountScope}
          discountMonths={p.discountMonths}
          toggleDiscountMonth={p.toggleDiscountMonth}
          planMonthKeys={p.planMonthKeys}
          planTotalPreview={p.planTotalPreview}
          assignStartsOn={p.assignStartsOn}
          setAssignStartsOn={p.setAssignStartsOn}
          assignEndsOn={p.assignEndsOn}
          setAssignEndsOn={p.setAssignEndsOn}
          monthOptions={p.monthOptions}
          yearOptions={p.yearOptions}
          assignPeriodDisplay={p.assignPeriodDisplay}
          onClose={() => { p.setAssignOpen(false); p.setAssignError(null); }}
          onSubmit={p.submitAssign}
        />

        {/* Delete modal */}
        <DeleteSubscriptionModal
          target={p.deleteTarget}
          deleting={p.deleting}
          isDark={p.isDark}
          onCancel={() => p.setDeleteTarget(null)}
          onConfirm={p.confirmDelete}
        />

      </div>
    </>
  );
}
