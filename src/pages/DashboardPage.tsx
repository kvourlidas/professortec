// src/pages/DashboardPage.tsx
import { useAuth } from '../auth.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import DashboardMetricsSection from '../components/dashboard/DashboardMetricsSection.tsx';
import DashboardMonthlyTestsAvgGradesSection from '../components/dashboard/DashboardMonthlyTestsAvgGradesSection.tsx';
import DashboardNotesSection from '../components/dashboard/DashboardNotesSection.tsx';
import DashboardCalendarSection from '../components/dashboard/DashboardCalendarSection.tsx';
import DashboardUpcomingSessionsSection from '../components/dashboard/DashboardUpcomingSessionsSection.tsx';
import { BookOpen, GraduationCap, Pencil, Calculator, Lightbulb, Bookmark, School } from 'lucide-react';

const BG_ICONS = [BookOpen, GraduationCap, Pencil, Calculator, Lightbulb, Bookmark, School];
const BG_WATERMARKS = Array.from({ length: 528 }, (_, i) => {
  const col = i % 24;
  const row = Math.floor(i / 24);
  const offsetX = row % 2 === 0 ? 0 : 2;
  return {
    Icon: BG_ICONS[i % BG_ICONS.length],
    x: offsetX + col * 4,
    y: row * 4.5,
    rotate: ((i * 41) % 54) - 27,
    size: 13 + (i % 3) * 3,
  };
});

export default function DashboardPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  return (
    <div className="relative overflow-hidden space-y-6">
      {/* ── Background watermarks ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {BG_WATERMARKS.map((wm, i) => {
          const Icon = wm.Icon;
          return (
            <Icon
              key={i}
              size={wm.size}
              style={{
                position: 'absolute',
                left: `${wm.x}%`,
                top: `${wm.y}%`,
                opacity: isDark ? 0.12 : 0.09,
                transform: `rotate(${wm.rotate}deg)`,
                color: isDark ? '#cbd5e1' : '#334155',
              }}
            />
          );
        })}
      </div>
      {/* Row 1: Notes (compact) + Upcoming Sessions */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch [&>*]:flex [&>*]:flex-col">
        <DashboardNotesSection schoolId={schoolId} />
        <DashboardUpcomingSessionsSection schoolId={schoolId} />
      </div>

      {/* Row 2: Metrics + Tests (temporarily hidden) */}
      {/* <div className="grid gap-4 lg:grid-cols-2">
        <DashboardMetricsSection schoolId={schoolId} />
        <DashboardMonthlyTestsAvgGradesSection schoolId={schoolId} />
      </div> */}

      {/* Row 3: Calendar */}
      <DashboardCalendarSection schoolId={schoolId} />
    </div>
  );
}

