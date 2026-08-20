import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';

import type { NotificationRow, RecipientMode, StudentOption, ClassOption } from '../../components/notifications/types';
import { getScrollbarStyle } from '../../components/notifications/utils';
import { NotificationSendForm } from '../../components/notifications/NotificationSendForm';
import { NotificationHistory } from '../../components/notifications/NotificationHistory';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function SendNotificationsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  // ── Form state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [loadingSend, setLoadingSend] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Students & classes data ──────────────────────────────────────────────
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    const loadStudents = async () => {
      setStudentsLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true });
      if (!error && data) setStudents(data as StudentOption[]);
      setStudentsLoading(false);
    };

    const loadClasses = async () => {
      setClassesLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('id, title')
        .eq('school_id', schoolId)
        .order('title', { ascending: true });
      if (!error && data) setClasses(data as ClassOption[]);
      setClassesLoading(false);
    };

    loadStudents();
    loadClasses();
  }, [schoolId]);

  // ── History state ────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<NotificationRow[]>([]);

  const loadHistory = async () => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_school_notifications_history', { p_limit: 50 });
      if (error) {
        console.error(error);
        setHistoryError(error.message || 'Αποτυχία φόρτωσης ιστορικού.');
        setHistoryItems([]);
        return;
      }
      setHistoryItems((data as NotificationRow[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setHistoryError(e?.message ?? 'Κάτι πήγε στραβά.');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  // ── Send ─────────────────────────────────────────────────────────────────
  const send = async () => {
    setResultMsg(null);
    setErrorMsg(null);

    if (!title.trim() || !body.trim()) {
      setErrorMsg('Συμπλήρωσε τίτλο και μήνυμα.');
      return;
    }

    if (recipientMode === 'students' && selectedStudentIds.length === 0) {
      setErrorMsg('Επίλεξε τουλάχιστον έναν μαθητή.');
      return;
    }

    if (recipientMode === 'classes' && selectedClassIds.length === 0) {
      setErrorMsg('Επίλεξε τουλάχιστον ένα τμήμα.');
      return;
    }

    setLoadingSend(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('send-push-notifications', {
        body: {
          title: title.trim(),
          body: body.trim(),
          kind: 'general',
          data: {
            screen: 'home',
            recipient_mode: recipientMode,
            recipient_names: recipientMode === 'students'
              ? students.filter(s => selectedStudentIds.includes(s.id)).map(s => s.full_name)
              : recipientMode === 'classes'
              ? classes.filter(c => selectedClassIds.includes(c.id)).map(c => c.title)
              : [],
          },
          student_ids: recipientMode === 'students' ? selectedStudentIds : [],
          class_ids:   recipientMode === 'classes'  ? selectedClassIds   : [],
        },
      });

      if (error) {
        console.error(error);
        setErrorMsg(error.message || 'Αποτυχία αποστολής.');
        return;
      }

      const pushed: number = result?.pushed ?? 0;
      setResultMsg(pushed > 0
        ? `Η ειδοποίηση στάλθηκε σε ${pushed} μαθητή/ές!`
        : 'Η ειδοποίηση αποθηκεύτηκε (κανένας μαθητής δεν είχε ενεργοποιημένες ειδοποιήσεις).');
      setTitle('');
      setBody('');
      setRecipientMode('all');
      setSelectedStudentIds([]);
      setSelectedClassIds([]);

      // ✅ Wait briefly for the DB to finish committing before refreshing history
      await sleep(800);
      await loadHistory();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally {
      setLoadingSend(false);
    }
  };

  return (
    <div className="space-y-6 px-1">
      <style>{getScrollbarStyle(isDark)}</style>

      {/* Header */}
      <div className="flex items-start justify-end gap-4">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            isDark
              ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent)]'
              : 'border-slate-200 bg-white text-slate-500 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent)]'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Ιστορικό
          {historyItems.length > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}
            >
              {historyItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Send form */}
      <NotificationSendForm
        title={title}
        onTitleChange={setTitle}
        body={body}
        onBodyChange={setBody}
        recipientMode={recipientMode}
        onRecipientModeChange={setRecipientMode}
        selectedStudentIds={selectedStudentIds}
        onSelectedStudentIdsChange={setSelectedStudentIds}
        selectedClassIds={selectedClassIds}
        onSelectedClassIdsChange={setSelectedClassIds}
        students={students}
        classes={classes}
        studentsLoading={studentsLoading}
        classesLoading={classesLoading}
        loadingSend={loadingSend}
        errorMsg={errorMsg}
        resultMsg={resultMsg}
        onSend={send}
        isDark={isDark}
      />

      <NotificationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyLoading={historyLoading}
        historyError={historyError}
        historyItems={historyItems}
        onRefresh={loadHistory}
        isDark={isDark}
      />
    </div>
  );
}