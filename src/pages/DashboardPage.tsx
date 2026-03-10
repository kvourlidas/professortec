// src/pages/DashboardPage.tsx
import { useAuth } from '../auth.tsx';
import DashboardMetricsSection from '../components/dashboard/DashboardMetricsSection.tsx';
import DashboardMonthlyTestsAvgGradesSection from '../components/dashboard/DashboardMonthlyTestsAvgGradesSection.tsx';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection.tsx';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection.tsx';

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="space-y-6">
      {/* Top row: 2 widgets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardMetricsSection schoolId={schoolId} />
        <DashboardMonthlyTestsAvgGradesSection schoolId={schoolId} />
      </div>

      <DashboardNotesSection schoolId={schoolId} />
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}
