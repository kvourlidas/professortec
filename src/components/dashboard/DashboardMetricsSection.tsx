// src/components/dashboard/DashboardMetricsSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

type SubscriptionSplit = {
  totalStudents: number; activeWithSub: number; inactiveNoSub: number;
  loading: boolean; error: string | null;
};

type Props = { schoolId: string | null };

function BigDonut({ active, inactive }: { active: number; inactive: number }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const total = Math.max(0, active + inactive);
  const pct = total === 0 ? 0 : Math.round((active / total) * 100);

  const inactiveColor = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.15)';

  const style = useMemo(() => ({
    background: `conic-gradient(var(--color-accent) ${pct}%, ${inactiveColor} 0)`,
  } as React.CSSProperties), [pct, inactiveColor]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-32 w-32 rounded-full" style={style} aria-label={`Ενεργοί μαθητές ${pct}%`}>
        <div className="absolute inset-4 rounded-full" style={{ background: 'var(--color-sidebar)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{pct}%</span>
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ενεργοί</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Ενεργοί</span>
          <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{active}</span>
        </div>
        <div className={`h-3 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Μη ενεργοί</span>
          <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{inactive}</span>
        </div>
      </div>

      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
        <Users className="h-3 w-3" />
        Σύνολο: <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{total}</span>
      </span>
    </div>
  );
}

export default function DashboardMetricsSection({ schoolId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    <section className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
        : 'border-slate-200 bg-white/80 ring-black/[0.02]'
    }`}>
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      <div className="px-5 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
            <Users className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Συνδρομές μαθητών</p>
            <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ενεργοί με συνδρομή vs μη ενεργοί</p>
          </div>
        </div>

        {subs.loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση…</span>
          </div>
        ) : subs.error ? (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{subs.error}
          </div>
        ) : (
          <>
            <BigDonut active={subs.activeWithSub} inactive={subs.inactiveNoSub} />
            <p className={`mt-4 text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>* Υπολογισμός με unique student_id από ενεργές συνδρομές.</p>
          </>
        )}
      </div>
    </section>
  );
}