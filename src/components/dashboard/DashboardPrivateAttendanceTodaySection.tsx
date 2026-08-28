// src/components/dashboard/DashboardPrivateAttendanceTodaySection.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ClipboardCheck, ChevronRight, Loader2 } from 'lucide-react';

type Props = { schoolId: string | null };

function pad2(n: number) { return String(n).padStart(2, '0'); }
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function DashboardPrivateAttendanceTodaySection({ schoolId }: Props) {
  const navigate = useNavigate();

  const [present, setPresent] = useState(0);
  const [absent, setAbsent] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const today = todayISO();
        const [presentRes, absentRes] = await Promise.all([
          supabase.from('private_lesson_attendance').select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId).eq('session_date', today).eq('status', 'present'),
          supabase.from('private_lesson_attendance').select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId).eq('session_date', today).eq('status', 'absent'),
        ]);
        if (cancelled) return;
        setPresent(presentRes.count ?? 0);
        setAbsent(absentRes.count ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  const total = present + absent;

  return (
    <button
      type="button"
      onClick={() => navigate('/attendance')}
      className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-6 py-7 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] active:brightness-100"
      style={{ background: '#6B21A8' }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <ClipboardCheck className="h-10 w-10 shrink-0 text-white" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-none text-white">Παρουσίες σήμερα</p>
          {loading ? (
            <Loader2 className="mt-2.5 h-5 w-5 animate-spin text-white/70" />
          ) : total === 0 ? (
            <p className="mt-2.5 text-sm font-medium text-white/80">Καμία καταχώρηση ακόμα</p>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none tabular-nums text-white">{present}</span>
                <span className="text-[11px] font-medium text-white/70">παρόντες</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold leading-none tabular-nums text-white">{absent}</span>
                <span className="text-[11px] font-medium text-white/70">απόντες</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-white/70 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}
