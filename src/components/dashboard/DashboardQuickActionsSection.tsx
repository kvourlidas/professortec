// src/components/dashboard/DashboardQuickActionsSection.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { ChevronRight, GraduationCap, UserCog, BookOpen, ClipboardList, Bot, Loader2 } from 'lucide-react';
import AssistantChat from '../assistant/AssistantChat';

type ActionKey = 'students' | 'tutors' | 'classes' | 'tests' | 'ai';
type CountedActionKey = Exclude<ActionKey, 'ai'>;

type Props = { schoolId: string | null; actions: ActionKey[] };

type Counts = Record<CountedActionKey, number | null>;

const ACTION_DEFS: Record<ActionKey, { label: string; path: string; icon: typeof GraduationCap; accent: string }> = {
  students: { label: 'Μαθητές', path: '/students', icon: GraduationCap, accent: '#3b82f6' },
  tutors: { label: 'Καθηγητές', path: '/tutors', icon: UserCog, accent: '#8b5cf6' },
  classes: { label: 'Τμήματα', path: '/classes', icon: BookOpen, accent: '#14b8a6' },
  tests: { label: 'Διαγωνίσματα', path: '/program/tests', icon: ClipboardList, accent: '#f43f5e' },
  ai: { label: 'Vela', path: '', icon: Bot, accent: '#FF8A2E' },
};

async function fetchCount(key: CountedActionKey, schoolId: string): Promise<number> {
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
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const countedActions = actions.filter((key): key is CountedActionKey => key !== 'ai');
    if (!schoolId || countedActions.length === 0) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(countedActions.map((key) => fetchCount(key, schoolId)));
        if (cancelled) return;
        setCounts((prev) => {
          const next = { ...prev };
          countedActions.forEach((key, i) => { next[key] = results[i]; });
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

      <div className={`grid gap-3 ${gridColsCls}`}>
        {actions.map((key) => {
          const { label, path, icon: Icon, accent } = ACTION_DEFS[key];
          const isAi = key === 'ai';
          return (
            <button
              key={key}
              type="button"
              onClick={() => (isAi ? setAssistantOpen(true) : navigate(path))}
              className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-6 py-7 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] active:brightness-100"
              style={{ background: accent }}
            >
              <div className="flex min-w-0 items-center gap-4">
                <Icon className="h-10 w-10 shrink-0 text-white" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold leading-none text-white">{label}</p>
                  {isAi ? (
                    <p className="mt-2 truncate text-sm font-medium text-white/80">Λειτουργίες AI</p>
                  ) : (
                    <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-white">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin text-white/70" /> : counts[key] ?? '—'}
                    </p>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0 text-white/70 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {assistantOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px]">
          <AssistantChat onClose={() => setAssistantOpen(false)} />
        </div>
      )}
    </div>
  );
}
