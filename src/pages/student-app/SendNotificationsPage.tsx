import { useEffect, useMemo, useState } from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';

import type { Kind, NotificationRow } from '../../components/notifications/types';
import { KIND_LABELS } from '../../components/notifications/constants';
import { getScrollbarStyle } from '../../components/notifications/utils';
import { NotificationSendForm } from '../../components/notifications/NotificationSendForm';
import { NotificationHistory } from '../../components/notifications/NotificationHistory';

export default function SendNotificationsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('general');
  const [loadingSend, setLoadingSend] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<NotificationRow[]>([]);

  const kindLabelSelected = useMemo(() => KIND_LABELS[kind], [kind]);

  const broadcastBadgeCls = isDark
    ? 'hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-1.5'
    : 'hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5';

  const loadHistory = async () => {
    setHistoryError(null); setHistoryLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_school_notifications_history', { p_limit: 15 });
      if (error) { console.error(error); setHistoryError(error.message || 'Αποτυχία φόρτωσης ιστορικού.'); setHistoryItems([]); return; }
      setHistoryItems((data as NotificationRow[]) ?? []);
    } catch (e: any) {
      console.error(e); setHistoryError(e?.message ?? 'Κάτι πήγε στραβά.'); setHistoryItems([]);
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async () => {
    setResultMsg(null); setErrorMsg(null);
    if (!title.trim() || !body.trim()) { setErrorMsg('Συμπλήρωσε τίτλο και μήνυμα.'); return; }
    setLoadingSend(true);
    try {
      const { data, error } = await supabase.rpc('send_school_notification', { p_title: title.trim(), p_body: body.trim(), p_kind: kind, p_data: { screen: 'home' } });
      if (error) { console.error(error); setErrorMsg(error.message || 'Αποτυχία αποστολής.'); return; }
      const count = Number(data ?? 0);
      setResultMsg(`Στάλθηκε σε ${count} μαθητές.`);
      setTitle(''); setBody(''); setKind('general');
      await loadHistory();
    } catch (e: any) {
      console.error(e); setErrorMsg(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally { setLoadingSend(false); }
  };

  return (
    <div className="space-y-6 px-1">
      <style>{getScrollbarStyle(isDark)}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Bell className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Ειδοποιήσεις μαθητών
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Στείλε ανακοίνωση σε όλους τους μαθητές της σχολής σου (mobile app).
            </p>
          </div>
        </div>
        <div className={broadcastBadgeCls}>
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>School broadcast</span>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <NotificationSendForm
          title={title} onTitleChange={setTitle}
          body={body} onBodyChange={setBody}
          kind={kind} onKindChange={setKind}
          kindLabelSelected={kindLabelSelected}
          loadingSend={loadingSend}
          errorMsg={errorMsg}
          resultMsg={resultMsg}
          onSend={send}
          isDark={isDark}
        />

        <NotificationHistory
          historyLoading={historyLoading}
          historyError={historyError}
          historyItems={historyItems}
          onRefresh={loadHistory}
          isDark={isDark}
        />
      </div>
    </div>
  );
}
