// src/components/dashboard/DashboardMetricsSection.tsx
import { useEffect, useState } from 'react';
import StatWidget from '../StatWidget';

type DashboardStats = {
  studentsCount: number;
  monthlyIncome: number;
  yearlyIncome: number;
};

type DashboardMetricsSectionProps = {
  schoolId: string | null;
};

export default function DashboardMetricsSection({
  schoolId,
}: DashboardMetricsSectionProps) {
  const [stats, setStats] = useState<DashboardStats>({
    studentsCount: 0,
    monthlyIncome: 0,
    yearlyIncome: 0,
  });

  // Placeholder – hook real stats here when ready
  useEffect(() => {
    if (!schoolId) return;

    setStats({
      studentsCount: 0,
      monthlyIncome: 0,
      yearlyIncome: 0,
    });
  }, [schoolId]);

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <StatWidget
        title="Σύνολο μαθητών"
        value={stats.studentsCount}
        subtitle="Θα συνδεθεί με το σύστημα μαθητών."
        variant="primary"
      />

      <StatWidget
        title="Μηνιαίο εισόδημα"
        value={`€ ${stats.monthlyIncome.toFixed(2)}`}
        subtitle="Θα υπολογίζεται από τις πληρωμές."
        variant="success"
      />

      <StatWidget
        title="Ετήσιο εισόδημα"
        value={`€ ${stats.yearlyIncome.toFixed(2)}`}
        subtitle="Θα ενημερώνεται αυτόματα μελλοντικά."
        variant="success"
      />
    </section>
  );
}
