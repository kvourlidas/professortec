// src/components/dashboard/DashboardMetricsSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, Loader2 } from 'lucide-react';

type SubscriptionSplit = {
  totalStudents: number; activeWithSub: number; inactiveNoSub: number;
  loading: boolean; error: string | null;
};

type Props = { schoolId: string | null };

function BigDonut({ active, inactive }: { active: number; inactive: number }) {
  const total = Math.max(0, active + inactive);
  const pct = total === 0 ? 0 : Math.round((active / total) * 100);

  const style = useMemo(() => ({
    background: `conic-gradient(var(--color-accent) ${pct}%, rgba(148,163,184,0.18) 0)`,
  } as React.CSSProperties), [pct]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Donut */}
      <div className="relative h-32 w-32 rounded-full" style={style} aria-label={`Ενεργοί μαθητές ${pct}%`}>
        <div className="absolute inset-4 rounded-full" style={{ background: 'var(--color-sidebar)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-100">{pct}%</span>
          <span className="text-[10px] text-slate-400">ενεργοί</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
          <span className="text-slate-400">Ενεργοί</span>
          <span className="font-semibold text-slate-100">{active}</span>
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          <span className="text-slate-400">Μη ενεργοί</span>
          <span className="font-semibold text-slate-100">{inactive}</span>
        </div>
      </div>

      {/* Total pill */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-[11px] text-slate-400">
        <Users className="h-3 w-3" />
        Σύνολο: <span className="font-semibold text-slate-200">{total}</span>
      </span>
    </div>
  );
}

export default function DashboardMetricsSection({ schoolId }: Props) {
  const [subs, setSubs] = useState<SubscriptionSplit>({ totalStudents: 0, activeWithSub: 0, inactiveNoSub: 0, loading: false, error: null });

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setSubs((p) => ({ ...p, loading: true, error: null }));
      try {
        const totalRes = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
        const totalStudents = totalRes.count ?? 0;
        const activeRes = await supabase.from('v_active_students_with_subscription').select('student_id', { count: 'exact', head: true }).eq('school_id', schoolId);
        const activeWithSub = activeRes.count ?? 0;
        if (cancelled) return;
        setSubs({ totalStudents, activeWithSub, inactiveNoSub: Math.max(0, totalStudents - activeWithSub), loading: false, error: null });
      } catch (e: any) {
        if (cancelled) return;
        setSubs((p) => ({ ...p, loading: false, error: e?.message ?? 'Αποτυχία φόρτωσης.' }));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      <div className="px-5 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
            <Users className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-50">Συνδρομές μαθητών</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Ενεργοί με συνδρομή vs μη ενεργοί</p>
          </div>
        </div>

        {subs.loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span className="text-xs text-slate-500">Φόρτωση…</span>
          </div>
        ) : subs.error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-xs text-red-200">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{subs.error}
          </div>
        ) : (
          <>
            <BigDonut active={subs.activeWithSub} inactive={subs.inactiveNoSub} />
            <p className="mt-4 text-[10px] text-slate-600">* Υπολογισμός με unique student_id από ενεργές συνδρομές.</p>
          </>
        )}
      </div>
    </section>
  );
}