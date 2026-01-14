// src/components/dashboard/DashboardMetricsSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type SubscriptionSplit = {
  totalStudents: number;
  activeWithSub: number;
  inactiveNoSub: number;
  loading: boolean;
  error: string | null;
};

type Props = {
  schoolId: string | null;
};

function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg ring-1 ring-inset ring-slate-300/15 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-50">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>
        )}
      </div>

      {children}
    </section>
  );
}

function BigDonut({
  active,
  inactive,
}: {
  active: number;
  inactive: number;
}) {
  const total = Math.max(0, active + inactive);
  const pct = total === 0 ? 0 : Math.round((active / total) * 100);

  const style = useMemo(() => {
    return {
      background: `conic-gradient(
        var(--color-accent) ${pct}%,
        rgba(148,163,184,0.25) 0
      )`,
    } as React.CSSProperties;
  }, [pct]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* DONUT (smaller) */}
      <div
        className="relative h-32 w-32 rounded-full"
        style={style}
        aria-label={`Ενεργοί μαθητές ${pct}%`}
      >
        <div
          className="absolute inset-4 rounded-full"
          style={{ background: 'var(--color-sidebar)' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-slate-100">{pct}%</div>
          <div className="text-[10px] text-slate-400">ενεργοί</div>
        </div>
      </div>

      {/* LEGEND */}
      <div className="text-center text-xs">
        <div className="text-slate-200">
          <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
            Ενεργοί
          </span>{' '}
          {active}
          <span className="mx-2 text-slate-500">•</span>
          <span className="text-slate-300">Μη ενεργοί</span> {inactive}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Σύνολο μαθητών: {total}
        </div>
      </div>
    </div>
  );
}

export default function DashboardMetricsSection({ schoolId }: Props) {
  const [subs, setSubs] = useState<SubscriptionSplit>({
    totalStudents: 0,
    activeWithSub: 0,
    inactiveNoSub: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!schoolId) return;

    let cancelled = false;

    const load = async () => {
      setSubs((p) => ({ ...p, loading: true, error: null }));

      try {
        // total students
        const totalRes = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId);

        const totalStudents = totalRes.count ?? 0;

        // active students (VIEW)
        const activeRes = await supabase
          .from('v_active_students_with_subscription')
          .select('student_id', { count: 'exact', head: true })
          .eq('school_id', schoolId);

        const activeWithSub = activeRes.count ?? 0;
        const inactiveNoSub = Math.max(0, totalStudents - activeWithSub);

        if (cancelled) return;

        setSubs({
          totalStudents,
          activeWithSub,
          inactiveNoSub,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setSubs((p) => ({
          ...p,
          loading: false,
          error: e?.message ?? 'Αποτυχία φόρτωσης.',
        }));
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return (
    <CardShell
      title="Συνδρομές μαθητών"
      subtitle="Ενεργοί με συνδρομή vs μη ενεργοί"
    >
      {subs.loading ? (
        <div className="py-10 text-center text-sm text-slate-200">Φόρτωση…</div>
      ) : subs.error ? (
        <div className="rounded border border-red-500 bg-red-900/40 px-3 py-2 text-xs text-red-100">
          {subs.error}
        </div>
      ) : (
        <>
          <BigDonut active={subs.activeWithSub} inactive={subs.inactiveNoSub} />
          <div className="mt-3 text-[10px] text-slate-500">
            * Υπολογισμός με unique student_id από ενεργές συνδρομές.
          </div>
        </>
      )}
    </CardShell>
  );
}
