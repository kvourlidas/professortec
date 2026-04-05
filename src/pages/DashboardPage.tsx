// src/pages/DashboardPage.tsx
import { useAuth } from '../auth.tsx';
import DashboardMetricsSection from '../components/dashboard/DashboardMetricsSection.tsx';
import DashboardMonthlyTestsAvgGradesSection from '../components/dashboard/DashboardMonthlyTestsAvgGradesSection.tsx';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection.tsx';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection.tsx';
import DashboardUpcomingSessionsSection from '../components/dashboard/DashboardUpcomingSessionsSection.tsx';

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="space-y-6">
      {/* Row 1: Notes (compact) + Upcoming Sessions */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch [&>*]:flex [&>*]:flex-col">
        <DashboardNotesSection schoolId={schoolId} />
        <DashboardUpcomingSessionsSection schoolId={schoolId} />
      </div>

      {/* Row 2: Metrics + Tests */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardMetricsSection schoolId={schoolId} />
        <DashboardMonthlyTestsAvgGradesSection schoolId={schoolId} />
      </div>

      {/* Row 3: Calendar */}
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}
