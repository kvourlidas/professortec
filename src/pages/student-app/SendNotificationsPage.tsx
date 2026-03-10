import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';

import type { NotificationRow, RecipientMode, StudentOption, ClassOption } from '../../components/notifications/types';
import { getScrollbarStyle } from '../../components/notifications/utils';
import { NotificationSendForm } from '../../components/notifications/NotificationSendForm';
import { NotificationHistory } from '../../components/notifications/NotificationHistory';

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
      // Build RPC params based on recipient mode
      const rpcParams: Record<string, any> = {
        p_title: title.trim(),
        p_body: body.trim(),
        p_kind: 'general',
        p_data: {
          screen: 'home',
          recipient_mode: recipientMode,
          recipient_names: recipientMode === 'students'
            ? students.filter(s => selectedStudentIds.includes(s.id)).map(s => s.full_name)
            : recipientMode === 'classes'
            ? classes.filter(c => selectedClassIds.includes(c.id)).map(c => c.title)
            : [],
        },
      };

      if (recipientMode === 'students') {
        rpcParams.p_student_ids = selectedStudentIds;
      } else if (recipientMode === 'classes') {
        rpcParams.p_class_ids = selectedClassIds;
      }

      const { data, error } = await supabase.rpc('send_school_notification', rpcParams);

      if (error) {
        console.error(error);
        setErrorMsg(error.message || 'Αποτυχία αποστολής.');
        return;
      }

      setResultMsg('Η ειδοποίηση στάλθηκε επιτυχώς!');
      setTitle('');
      setBody('');
      setRecipientMode('all');
      setSelectedStudentIds([]);
      setSelectedClassIds([]);
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <Bell className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Ειδοποιήσεις μαθητών
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Στείλε ανακοίνωση σε μαθητές της σχολής σου (mobile app).
            </p>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="grid gap-4 lg:grid-cols-2">
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