import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Send, Sparkles, History, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

type Kind = 'general' | 'message' | 'schedule' | 'test';

const KIND_LABELS: Record<Kind, string> = {
  general: 'Γενικό',
  message: 'Μήνυμα',
  schedule: 'Πρόγραμμα',
  test: 'Διαγώνισμα',
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
};

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SendNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('general');

  const [loadingSend, setLoadingSend] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // history
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<NotificationRow[]>([]);

  const kindLabelSelected = useMemo(() => KIND_LABELS[kind], [kind]);

  const loadHistory = async () => {
    setHistoryError(null);
    setHistoryLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_school_notifications_history', {
        p_limit: 15,
      });

      if (error) {
        console.error('history rpc error', error);
        setHistoryError(error.message || 'Αποτυχία φόρτωσης ιστορικού.');
        setHistoryItems([]);
        return;
      }

      setHistoryItems((data as NotificationRow[]) ?? []);
    } catch (e: any) {
      console.error('history rpc crash', e);
      setHistoryError(e?.message ?? 'Κάτι πήγε στραβά στο ιστορικό.');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setResultMsg(null);
    setErrorMsg(null);

    if (!title.trim() || !body.trim()) {
      setErrorMsg('Συμπλήρωσε τίτλο και μήνυμα.');
      return;
    }

    setLoadingSend(true);
    try {
      const { data, error } = await supabase.rpc('send_school_notification', {
        p_title: title.trim(),
        p_body: body.trim(),
        p_kind: kind,
        p_data: { screen: 'home' },
      });

      if (error) {
        console.error(error);
        setErrorMsg(error.message || 'Αποτυχία αποστολής.');
        return;
      }

      const count = Number(data ?? 0);
      setResultMsg(`✅ Στάλθηκε σε ${count} μαθητές.`);
      setTitle('');
      setBody('');
      setKind('general');

      // refresh history after sending
      await loadHistory();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally {
      setLoadingSend(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/40">
              <Bell className="h-5 w-5 text-sky-300" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-100">Ειδοποιήσεις μαθητών</h1>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-300/90">
            Στείλε ανακοίνωση σε όλους τους μαθητές της σχολής σου (mobile app).
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <Sparkles className="h-4 w-4 text-sky-300" />
          <span className="text-xs font-bold text-slate-200">School broadcast</span>
        </div>
      </div>

      {/* 2 columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: Send form */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/35 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-extrabold text-slate-200">Τίτλος</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="π.χ. Ανακοίνωση"
                className="h-11 w-full rounded-2xl border border-slate-700/70 bg-slate-950/35 px-4 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-extrabold text-slate-200">Μήνυμα</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Γράψε το μήνυμα…"
                rows={6}
                className="w-full resize-none rounded-2xl border border-slate-700/70 bg-slate-950/35 px-4 py-3 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-extrabold text-slate-200">Τύπος</label>

              <div className="relative">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-700/70 bg-slate-950/35 px-4 pr-10 text-sm font-semibold text-slate-100 outline-none focus:border-sky-400/60"
                >
                  <option value="general">{KIND_LABELS.general}</option>
                  <option value="message">{KIND_LABELS.message}</option>
                  <option value="schedule">{KIND_LABELS.schedule}</option>
                  <option value="test">{KIND_LABELS.test}</option>
                </select>

                <svg
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <div className="text-xs font-semibold text-slate-400">
                Επιλεγμένο: <span className="text-slate-200 font-extrabold">{kindLabelSelected}</span>
              </div>
            </div>

            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-400">
                Θα σταλεί σε <span className="text-slate-200 font-extrabold">όλους</span> τους μαθητές της σχολής σου.
              </div>

              <button
                onClick={send}
                disabled={loadingSend}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-5 py-3 text-sm font-extrabold text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="h-4 w-4" />
                {loadingSend ? 'Αποστολή…' : 'Στείλε ειδοποίηση'}
              </button>
            </div>

            {errorMsg ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                {errorMsg}
              </div>
            ) : null}

            {resultMsg ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                {resultMsg}
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT: History */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/35 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/40">
                <History className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-100">Ιστορικό αποστολών</div>
                <div className="text-xs font-semibold text-slate-400">Τελευταίες 15 ειδοποιήσεις</div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadHistory}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/25 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-slate-950/35"
            >
              <RefreshCw className="h-4 w-4 text-slate-300" />
              Ανανέωση
            </button>
          </div>

          {historyError ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
              {historyError}
            </div>
          ) : null}

          <div className="max-h-[520px] overflow-y-auto pr-1">
            {historyLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/20 px-4 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <div className="text-sm font-bold text-slate-200">Φόρτωση…</div>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/20 px-4 py-4 text-sm font-semibold text-slate-300">
                Δεν υπάρχουν αποστολές ακόμα.
              </div>
            ) : (
              <div className="grid gap-3">
                {historyItems.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-slate-700/60 bg-slate-950/20 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-100">{n.title}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-300">{n.body}</div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full border border-slate-700/60 bg-slate-900/40 px-2 py-1 text-[11px] font-extrabold text-slate-200">
                          {KIND_LABELS[(n.kind as Kind) ?? 'general'] ?? n.kind}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">{formatDt(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
