// src/pages/DashboardPage.tsx
import { useAuth } from '../auth.tsx';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection.tsx';
import DashboardUpcomingSessionsSection from '../components/dashboard/DashboardUpcomingSessionsSection.tsx';
import DashboardQuickActionsSection from '../components/dashboard/DashboardQuickActionsSection.tsx';
import DashboardSubscriptionAlertsSection from '../components/dashboard/DashboardSubscriptionAlertsSection.tsx';
import DashboardAttendanceTodaySection from '../components/dashboard/DashboardAttendanceTodaySection.tsx';
import DashboardUpcomingTestsSection from '../components/dashboard/DashboardUpcomingTestsSection.tsx';

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;
  const isFrontistirio = profile?.account_type === 'frontistirio';
  const quickActions = isFrontistirio
    ? (['students', 'tutors', 'classes', 'ai'] as const)
    : (['students', 'tests', 'ai'] as const);

  return (
    <div className="space-y-6">
      {/* Row 1: Notes (compact) + Upcoming Sessions */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-x-0 lg:divide-x divide-slate-200 dark:divide-slate-800 [&>*]:flex [&>*]:flex-col [&>*:first-child]:lg:pr-6 [&>*:last-child]:lg:pl-6">
        <DashboardNotesSection schoolId={schoolId} />
        <DashboardUpcomingSessionsSection schoolId={schoolId} />
      </div>

      {/* Row 2: Metrics + Tests (temporarily hidden) */}
      {/* <div className="grid gap-4 lg:grid-cols-2">
        <DashboardMetricsSection schoolId={schoolId} />
        <DashboardMonthlyTestsAvgGradesSection schoolId={schoolId} />
      </div> */}

      {/* Quick actions */}
      <DashboardQuickActionsSection schoolId={schoolId} actions={[...quickActions]} />

      {/* Attendance today + upcoming tests — same tile size as quick actions */}
      <div className={`grid gap-3 ${isFrontistirio ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {isFrontistirio && <DashboardAttendanceTodaySection schoolId={schoolId} />}
        <DashboardUpcomingTestsSection schoolId={schoolId} />
      </div>

      {/* Subscription alerts (frontistirio only) */}
      {isFrontistirio && (
        <div className="pt-2">
          <DashboardSubscriptionAlertsSection schoolId={schoolId} />
        </div>
      )}

    </div>
  );
}

