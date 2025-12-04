// src/pages/DashboardPage.tsx
import { useAuth } from '../auth';
import DashboardMetricsSection from '../components/dashboard/DashboardMetricsSection';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection';

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="space-y-6">
      <DashboardMetricsSection schoolId={schoolId} />
      <DashboardNotesSection schoolId={schoolId} />
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}
