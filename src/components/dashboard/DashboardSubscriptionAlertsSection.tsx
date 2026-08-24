// src/components/dashboard/DashboardSubscriptionAlertsSection.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { CalendarClock, AlertTriangle, ArrowRight, EyeOff, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

type SubRow = {
  id: string;
  student_id: string;
  package_name: string;
  status: string;
  ends_on: string | null;
  created_at: string | null;
};
type StudentRow = { id: string; full_name: string | null };

type ExpiringItem = { subId: string; studentId: string; studentName: string; packageName: string; endsOn: string; daysLeft: number };
type ExpiredItem = { subId: string; studentId: string; studentName: string; packageName: string; endsOn: string | null };

type Props = { schoolId: string | null };
const LOOKAHEAD_DAYS = 30;
const PAGE_SIZE = 3;

const pad2 = (n: number) => n.toString().padStart(2, '0');
function todayLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardSubscriptionAlertsSection({ schoolId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringItem[]>([]);
  const [expired, setExpired] = useState<ExpiredItem[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [soonPage, setSoonPage] = useState(0);
  const [expiredPage, setExpiredPage] = useState(0);

  const load = async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      await supabase.rpc('run_subscription_expiry', { p_school_id: schoolId });

      const today = todayLocalISODate();
      const horizon = new Date(); horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS);
      const horizonISO = `${horizon.getFullYear()}-${pad2(horizon.getMonth() + 1)}-${pad2(horizon.getDate())}`;

      const [{ data: activeData }, { data: endedData }] = await Promise.all([
        supabase.from('student_subscriptions')
          .select('id, student_id, package_name, status, ends_on, created_at')
          .eq('school_id', schoolId).eq('status', 'active'),
        supabase.from('student_subscriptions')
          .select('id, student_id, package_name, status, ends_on, created_at')
          .eq('school_id', schoolId).in('status', ['completed', 'canceled']).is('dashboard_dismissed_at', null),
      ]);

      const active = (activeData ?? []) as SubRow[];
      const ended = (endedData ?? []) as SubRow[];
      const activeStudentIds = new Set(active.map((s) => s.student_id));

      const studentIds = [...new Set([...active.map((s) => s.student_id), ...ended.map((s) => s.student_id)])];
      const studentNameById = new Map<string, string>();
      if (studentIds.length > 0) {
        const { data: sd } = await supabase.from('students').select('id, full_name').in('id', studentIds);
        (sd ?? []).forEach((s: StudentRow) => studentNameById.set(s.id, s.full_name ?? '—'));
      }

      const soon: ExpiringItem[] = active
        .filter((s) => s.ends_on && s.ends_on >= today && s.ends_on <= horizonISO)
        .map((s) => ({
          subId: s.id, studentId: s.student_id, studentName: studentNameById.get(s.student_id) ?? '—',
          packageName: s.package_name, endsOn: s.ends_on!, daysLeft: daysBetween(today, s.ends_on!),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft);

      // One row per student — the most recently-ended subscription — only for students who currently lack an active one.
      const latestEndedByStudent = new Map<string, SubRow>();
      ended.filter((s) => !activeStudentIds.has(s.student_id)).forEach((s) => {
        const prev = latestEndedByStudent.get(s.student_id);
        const sKey = s.ends_on ?? s.created_at ?? '';
        const prevKey = prev ? (prev.ends_on ?? prev.created_at ?? '') : '';
        if (!prev || sKey > prevKey) latestEndedByStudent.set(s.student_id, s);
      });
      const expiredList: ExpiredItem[] = [...latestEndedByStudent.values()]
        .map((s) => ({ subId: s.id, studentId: s.student_id, studentName: studentNameById.get(s.student_id) ?? '—', packageName: s.package_name, endsOn: s.ends_on }))
        .sort((a, b) => (b.endsOn ?? '').localeCompare(a.endsOn ?? ''));

      setExpiringSoon(soon);
      setExpired(expiredList);
      setSoonPage(0);
      setExpiredPage(0);
    } catch (e) { console.error('Failed to load subscription alerts', e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = async (subId: string) => {
    setDismissingId(subId);
    const { error } = await supabase.from('student_subscriptions').update({ dashboard_dismissed_at: new Date().toISOString() }).eq('id', subId);
    setDismissingId(null);
    if (error) { console.error('Failed to dismiss subscription alert', error); return; }
    setExpired((prev) => prev.filter((e) => e.subId !== subId));
  };

  const totalAlerts = useMemo(() => expiringSoon.length + expired.length, [expiringSoon, expired]);

  const soonPageCount = Math.max(1, Math.ceil(expiringSoon.length / PAGE_SIZE));
  const expiredPageCount = Math.max(1, Math.ceil(expired.length / PAGE_SIZE));
  useEffect(() => setSoonPage((p) => Math.min(p, soonPageCount - 1)), [soonPageCount]);
  useEffect(() => setExpiredPage((p) => Math.min(p, expiredPageCount - 1)), [expiredPageCount]);
  const soonPageItems = expiringSoon.slice(soonPage * PAGE_SIZE, soonPage * PAGE_SIZE + PAGE_SIZE);
  const expiredPageItems = expired.slice(expiredPage * PAGE_SIZE, expiredPage * PAGE_SIZE + PAGE_SIZE);

  const muted = isDark ? 'text-slate-500' : 'text-slate-400';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const primary = isDark ? 'text-slate-50' : 'text-slate-900';
  const rule = isDark ? 'border-slate-800' : 'border-slate-100';

  const PanelLabel = ({ children, count, tone }: { children: React.ReactNode; count: number; tone: 'amber' | 'red' }) => (
    <div className="mb-3 flex shrink-0 items-center justify-between">
      <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${muted}`}>{children}</p>
      {count > 0 && (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          tone === 'amber'
            ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')
            : (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700')
        }`}>{count}</span>
      )}
    </div>
  );

  const Pager = ({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) => (
    pageCount > 1 ? (
      <div className="flex shrink-0 items-center justify-between gap-2 pt-2">
        <button type="button" disabled={page <= 0} onClick={() => onChange(page - 1)}
          className={`flex h-6 w-6 items-center justify-center rounded transition disabled:opacity-30 ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className={`text-[10px] ${muted}`}>{page + 1} / {pageCount}</span>
        <button type="button" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}
          className={`flex h-6 w-6 items-center justify-center rounded transition disabled:opacity-30 ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    ) : null
  );

  const NoAlert = ({ label }: { label: string }) => (
    <div className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-center ${
      isDark ? 'border-slate-700/50' : 'border-slate-200'
    }`}>
      <CalendarClock className={`h-5 w-5 ${muted}`} />
      <p className={`text-[11px] ${muted}`}>{label}</p>
    </div>
  );

  if (!schoolId) return null;

  return (
    <section className="flex flex-col flex-1">
      <div className="flex shrink-0 items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
          <p className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>Συνδρομές</p>
        </div>
        {!loading && totalAlerts > 0 && (
          <span className={`text-[10px] font-medium uppercase tracking-wide ${muted}`}>{totalAlerts} χρήζουν προσοχής</span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-10">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          <span className={`text-xs ${muted}`}>Φόρτωση…</span>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 pt-4">

          {/* LEFT — Expiring soon */}
          <div className="flex flex-col flex-1 min-h-0 pr-4">
            <PanelLabel count={expiringSoon.length} tone="amber">Λήγουν σε 30 ημέρες</PanelLabel>
            {expiringSoon.length > 0 ? (
              <div className={`flex flex-col flex-1 min-h-0 divide-y overflow-y-auto ${rule}`}>
                {soonPageItems.map((item) => (
                  <div key={item.subId} className="relative py-2.5 pl-3 pr-1 cursor-pointer transition-colors hover:bg-amber-500/[0.08]"
                    style={{ borderLeftColor: isDark ? '#fbbf24' : '#f59e0b', borderLeftWidth: 3 }}
                    onClick={() => navigate(`/students/${item.studentId}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-[13px] font-semibold ${primary}`}>{item.studentName}</p>
                        <p className={`truncate text-[10px] ${sub}`}>{item.packageName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-xs font-bold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                          {item.daysLeft === 0 ? 'Σήμερα' : item.daysLeft === 1 ? 'Αύριο' : `${item.daysLeft} ημέρες`}
                        </p>
                        <p className={`text-[10px] tabular-nums ${muted}`}>{formatDMY(item.endsOn)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <NoAlert label="Καμία συνδρομή δεν λήγει σύντομα" />
            )}
            <Pager page={soonPage} pageCount={soonPageCount} onChange={setSoonPage} />
          </div>

          <div className={`w-px shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* RIGHT — Expired */}
          <div className="flex flex-col flex-1 min-h-0 pl-4">
            <PanelLabel count={expired.length} tone="red">Έληξαν</PanelLabel>
            {expired.length > 0 ? (
              <div className={`flex flex-col flex-1 min-h-0 divide-y overflow-y-auto ${rule}`}>
                {expiredPageItems.map((item) => (
                  <div key={item.subId} className="relative py-2.5 pl-3 pr-1"
                    style={{ borderLeftColor: isDark ? '#f87171' : '#dc2626', borderLeftWidth: 3 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-[13px] font-semibold ${primary}`}>{item.studentName}</p>
                        <p className={`truncate text-[10px] ${sub}`}>{item.packageName}</p>
                        {item.endsOn && <p className={`text-[10px] tabular-nums ${muted}`}>Έληξε {formatDMY(item.endsOn)}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" title="Παράβλεψη" disabled={dismissingId === item.subId}
                          onClick={() => dismiss(item.subId)}
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                            isDark ? 'border-slate-700/60 text-slate-500 hover:bg-slate-800 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                          {dismissingId === item.subId ? <Loader2 className="h-3 w-3 animate-spin" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        <button type="button" title="Ανανέωση συνδρομής" onClick={() => navigate(`/students/${item.studentId}`)}
                          className="flex h-6 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold transition active:scale-95"
                          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                          Ανανέωση
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <NoAlert label="Δεν υπάρχουν ληγμένες συνδρομές" />
            )}
            <Pager page={expiredPage} pageCount={expiredPageCount} onChange={setExpiredPage} />
          </div>

        </div>
      )}
    </section>
  );
}
