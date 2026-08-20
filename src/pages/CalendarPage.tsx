import { useAuth } from '../auth.tsx';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection.tsx';

export default function CalendarPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="space-y-4">
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}
