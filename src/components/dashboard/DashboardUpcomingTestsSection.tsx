// src/components/dashboard/DashboardUpcomingTestsSection.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ClipboardList, ChevronRight, Loader2 } from 'lucide-react';

type Props = { schoolId: string | null };

function pad2(n: number) { return String(n).padStart(2, '0'); }
function todayDate(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function toISO(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export default function DashboardUpcomingTestsSection({ schoolId }: Props) {
  const navigate = useNavigate();

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const from = todayDate();
        const to = new Date(from); to.setDate(to.getDate() + 6);
        const { count: c } = await supabase.from('tests').select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId).gte('test_date', toISO(from)).lte('test_date', toISO(to));
        if (cancelled) return;
        setCount(c ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  return (
    <button
      type="button"
      onClick={() => navigate('/program/tests')}
      className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-6 py-7 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] active:brightness-100"
      style={{ background: '#6D28D9' }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <ClipboardList className="h-10 w-10 shrink-0 text-white" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-none text-white">Διαγωνίσματα</p>
          <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-white/70" /> : count}
          </p>
          <p className="mt-2 text-[11px] font-medium text-white/70">επόμενες 7 ημέρες</p>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-white/70 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}
