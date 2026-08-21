// src/components/dashboard/DashboardQuickActionsSection.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { ChevronRight, GraduationCap, UserCog, BookOpen, ClipboardList, Loader2 } from 'lucide-react';

type ActionKey = 'students' | 'tutors' | 'classes' | 'tests';

type Props = { schoolId: string | null; actions: ActionKey[] };

type Counts = Record<ActionKey, number | null>;

const ACTION_DEFS: Record<ActionKey, { label: string; path: string; icon: typeof GraduationCap; accent: string }> = {
  students: { label: 'Μαθητές', path: '/students', icon: GraduationCap, accent: '#3b82f6' },
  tutors: { label: 'Καθηγητές', path: '/tutors', icon: UserCog, accent: '#8b5cf6' },
  classes: { label: 'Τμήματα', path: '/classes', icon: BookOpen, accent: '#f59e0b' },
  tests: { label: 'Διαγωνίσματα', path: '/program/tests', icon: ClipboardList, accent: '#f43f5e' },
};

async function fetchCount(key: ActionKey, schoolId: string): Promise<number> {
  const query =
    key === 'students' ? supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).is('deleted_at', null) :
    key === 'tutors' ? supabase.from('tutors').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).is('deleted_at', null) :
    key === 'classes' ? supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId) :
    supabase.from('tests').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
  const { count } = await query;
  return count ?? 0;
}

export default function DashboardQuickActionsSection({ schoolId, actions }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts>({ students: null, tutors: null, classes: null, tests: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(actions.map((key) => fetchCount(key, schoolId)));
        if (cancelled) return;
        setCounts((prev) => {
          const next = { ...prev };
          actions.forEach((key, i) => { next[key] = results[i]; });
          return next;
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, actions]);

  const gridColsCls = actions.length === 2 ? 'sm:grid-cols-2' : actions.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3';

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Γρήγορες ενέργειες</h2>
        <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σύνολα</span>
      </div>

      <div
        className={`grid overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${gridColsCls} ${
          isDark
            ? 'divide-y divide-slate-700/50 border-slate-700/50 bg-slate-950/40 ring-white/[0.04] sm:divide-x sm:divide-y-0'
            : 'divide-y divide-slate-200 border-slate-200 bg-white/80 ring-black/[0.02] sm:divide-x sm:divide-y-0'
        }`}
      >
        {actions.map((key) => {
          const { label, path, icon: Icon, accent } = ACTION_DEFS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(path)}
              className={`group relative flex items-center justify-between gap-2 px-5 py-4 text-left transition-colors ${
                isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
              }`}
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  <p className="truncate text-sm font-semibold" style={{ color: accent }}>{label}</p>
                </div>
                <p className={`mt-1 text-2xl font-bold leading-none tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-500" /> : counts[key] ?? '—'}
                </p>
              </div>

              <ChevronRight
                className={`h-4 w-4 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
