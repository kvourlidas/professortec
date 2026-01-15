// src/pages/DashboardPage.tsx
import { useAuth } from '../auth';
import DashboardMetricsSection from '../components/dashboard/DashboardMetricsSection';
import DashboardMonthlyTestsAvgGradesSection from '../components/dashboard/DashboardMonthlyTestsAvgGradesSection';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection';
import DashboardStudentsByClassCard from '../components/dashboard/DashboardStudentsByClassCard';

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="space-y-6">
      {/* Top row: 3 compact widgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardMetricsSection schoolId={schoolId} />
        <DashboardMonthlyTestsAvgGradesSection schoolId={schoolId} />
        <DashboardStudentsByClassCard schoolId={schoolId} />
      </div>

      <DashboardNotesSection schoolId={schoolId} />
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}
