import { useState, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Send, X, User, SquarePen } from 'lucide-react';
import kikaImg from '../../assets/kika-avatar.png';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useAuth } from '../../auth.tsx';
import ClassCreationWizard from './ClassCreationWizard.tsx';
import StudentLevelWizard from './StudentLevelWizard.tsx';
import type { PendingStudent, PendingStudentUpdate, CreatedStudent } from './StudentLevelWizard.tsx';
import TutorSpecialtyWizard from './TutorSpecialtyWizard.tsx';
import SubjectLevelWizard from './SubjectLevelWizard.tsx';
import SubjectTutorWizard from './SubjectTutorWizard.tsx';
import type { ClassRow, SubjectRow } from '../classes/types.ts';

type ChatMessage = { role: 'user' | 'assistant'; text: string };
type AssistantAction = { type: string; item: unknown };

// Opaque conversation history returned by the assistant-chat Edge Function.
// Sent back unmodified on the next request so Claude keeps context.
type HistoryEntry = { role: string; content: unknown };

const MESSAGES_KEY = 'pt_assistant_messages_v1';
const HISTORY_KEY  = 'pt_assistant_history_v1';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type Props = {
  onClose?: () => void;
};

// FunctionsHttpError from supabase-js carries the raw Response on `.context`.
function isUnauthorized(fnError: unknown): boolean {
  const status = (fnError as { context?: { status?: number } } | null)?.context?.status;
  return status === 401;
}

async function invokeAssistant(message: string, history: HistoryEntry[]) {
  const first = await supabase.functions.invoke('assistant-chat', {
    body: { message, history },
  });

  // Access token likely expired while the tab was backgrounded — the client
  // stops auto-refreshing on hidden tabs (see supabaseClient.ts), so a stale
  // token can outlive the session until the next explicit refresh. Force one
  // refresh and retry the call once before giving up.
  if (first.error && isUnauthorized(first.error)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) return first;
    return supabase.functions.invoke('assistant-chat', { body: { message, history } });
  }

  return first;
}

export default function AssistantChat({ onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(MESSAGES_KEY, [])
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadFromStorage<HistoryEntry[]>(HISTORY_KEY, [])
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingClassTitle, setPendingClassTitle] = useState<string | null>(null);
  const [pendingClassUpdate, setPendingClassUpdate] = useState<{ classId: string; title: string } | null>(null);
  const [pendingTutorSpecialty, setPendingTutorSpecialty] = useState<{ tutorId: string; tutorName: string } | null>(null);
  const [pendingSubjectName, setPendingSubjectName] = useState<string | null>(null);
  const [pendingSubjectTutors, setPendingSubjectTutors] = useState<{ subjectId: string; subjectName: string } | null>(null);
  const [pendingSubjectUpdate, setPendingSubjectUpdate] = useState<{ subjectId: string; name: string } | null>(null);
  type SubjectDisambiguationNext =
    | { kind: 'assign_tutors' }
    | { kind: 'update'; change_level: boolean; name?: string };
  const [pendingSubjectDisambiguation, setPendingSubjectDisambiguation] = useState<{
    subjectName: string;
    candidates: { id: string; name: string; level_id: string | null; level_name: string | null }[];
    next: SubjectDisambiguationNext;
  } | null>(null);
  const [pendingStudent, setPendingStudent] = useState<PendingStudent | null>(null);
  const [pendingStudentUpdate, setPendingStudentUpdate] = useState<PendingStudentUpdate | null>(null);

  // Persist messages and history whenever they change
  useEffect(() => {
    try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }, [history]);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setHistory([]);
    setError(null);
    try {
      localStorage.removeItem(MESSAGES_KEY);
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    resetTextareaHeight();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeAssistant(text, history);

      if (fnError || !data) {
        console.error(fnError ?? data);
        setError(
          isUnauthorized(fnError)
            ? 'Η σύνδεσή σου έληξε. Δοκίμασε να ανανεώσεις τη σελίδα.'
            : 'Κάτι πήγε στραβά. Δοκίμασε ξανά.'
        );
        return;
      }

      setHistory(data.history ?? []);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply || '...' }]);

      const actions: AssistantAction[] = Array.isArray(data.actions) ? data.actions : [];
      const needsClassLevel = actions.find((a) => a.type === 'class_needs_level_selection');
      if (needsClassLevel) {
        const item = needsClassLevel.item as { title?: string } | null;
        if (item?.title) setPendingClassTitle(item.title);
      }
      const needsStudentLevel = actions.find((a) => a.type === 'student_needs_level_selection');
      if (needsStudentLevel) {
        const item = needsStudentLevel.item as PendingStudent | null;
        if (item?.full_name) setPendingStudent(item);
      }
      const needsStudentUpdateLevel = actions.find((a) => a.type === 'student_update_needs_level_selection');
      if (needsStudentUpdateLevel) {
        const item = needsStudentUpdateLevel.item as PendingStudentUpdate | null;
        if (item?.student_id) setPendingStudentUpdate(item);
      }
      const needsClassUpdateSubject = actions.find((a) => a.type === 'class_update_needs_subject_selection');
      if (needsClassUpdateSubject) {
        const item = needsClassUpdateSubject.item as { class_id?: string; title?: string } | null;
        if (item?.class_id && item?.title) setPendingClassUpdate({ classId: item.class_id, title: item.title });
      }
      const needsTutorSpecialty = actions.find((a) => a.type === 'tutor_needs_specialty_selection');
      if (needsTutorSpecialty) {
        const item = needsTutorSpecialty.item as { tutor_id?: string; tutor_name?: string } | null;
        if (item?.tutor_id && item?.tutor_name) setPendingTutorSpecialty({ tutorId: item.tutor_id, tutorName: item.tutor_name });
      }
      const needsSubjectLevel = actions.find((a) => a.type === 'subject_needs_level_selection');
      if (needsSubjectLevel) {
        const item = needsSubjectLevel.item as { name?: string } | null;
        if (item?.name) setPendingSubjectName(item.name);
      }
      const needsSubjectTutors = actions.find((a) => a.type === 'subject_needs_tutor_selection');
      if (needsSubjectTutors) {
        const item = needsSubjectTutors.item as { subject_id?: string; subject_name?: string } | null;
        if (item?.subject_id && item?.subject_name) setPendingSubjectTutors({ subjectId: item.subject_id, subjectName: item.subject_name });
      }
      const needsSubjectDisambiguation = actions.find((a) => a.type === 'subject_needs_disambiguation');
      if (needsSubjectDisambiguation) {
        const item = needsSubjectDisambiguation.item as {
          subject_name?: string;
          candidates?: { id: string; name: string; level_id: string | null; level_name: string | null }[];
          next?: SubjectDisambiguationNext;
        } | null;
        if (item?.subject_name && item?.candidates?.length && item?.next) {
          setPendingSubjectDisambiguation({ subjectName: item.subject_name, candidates: item.candidates, next: item.next });
        }
      }
      const needsSubjectUpdateLevel = actions.find((a) => a.type === 'subject_update_needs_level_selection');
      if (needsSubjectUpdateLevel) {
        const item = needsSubjectUpdateLevel.item as { subject_id?: string; name?: string } | null;
        if (item?.subject_id && item?.name) setPendingSubjectUpdate({ subjectId: item.subject_id, name: item.name });
      }
    } catch (err) {
      console.error(err);
      setError('Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    } finally {
      setSending(false);
    }
  };

  const handleClassWizardDone = (createdClass: ClassRow | null) => {
    setPendingClassTitle(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: createdClass
          ? `Το τμήμα "${createdClass.title}" δημιουργήθηκε ✅`
          : 'Η δημιουργία του τμήματος ακυρώθηκε.',
      },
    ]);
  };

  const handleClassUpdateWizardDone = (updatedClass: ClassRow | null) => {
    setPendingClassUpdate(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: updatedClass
          ? `Το τμήμα "${updatedClass.title}" ενημερώθηκε ✅`
          : 'Η ενημέρωση του τμήματος απέτυχε.',
      },
    ]);
  };

  const handleTutorSpecialtyWizardDone = (assignedNames: string[] | null) => {
    setPendingTutorSpecialty(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text:
          assignedNames === null
            ? 'Η ενημέρωση ειδικοτήτων απέτυχε.'
            : assignedNames.length > 0
              ? `Ειδικότητες ενημερώθηκαν: ${assignedNames.join(', ')} ✅`
              : 'Οι ειδικότητες αφαιρέθηκαν ✅',
      },
    ]);
  };

  const handleSubjectWizardDone = (createdSubject: SubjectRow | null) => {
    setPendingSubjectName(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: createdSubject
          ? `Το μάθημα "${createdSubject.name}" δημιουργήθηκε ✅`
          : 'Η δημιουργία του μαθήματος απέτυχε.',
      },
    ]);
  };

  const handlePickAmbiguousSubject = async (
    candidate: { id: string; name: string; level_id: string | null; level_name: string | null },
    next: SubjectDisambiguationNext
  ) => {
    setPendingSubjectDisambiguation(null);
    const label = candidate.level_name ? `${candidate.name} (${candidate.level_name})` : candidate.name;

    if (next.kind === 'assign_tutors') {
      setPendingSubjectTutors({ subjectId: candidate.id, subjectName: label });
      return;
    }

    // next.kind === 'update'
    if (next.change_level) {
      setPendingSubjectUpdate({ subjectId: candidate.id, name: next.name ?? candidate.name });
      return;
    }

    const mergedName = next.name ?? candidate.name;
    const { data, error: fnError } = await supabase.functions.invoke('subjects-update', {
      body: { subject_id: candidate.id, name: mergedName, level_id: candidate.level_id },
    });

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text:
          !fnError && data?.item
            ? `Το μάθημα "${(data.item as SubjectRow).name}" ενημερώθηκε ✅`
            : 'Η ενημέρωση του μαθήματος απέτυχε.',
      },
    ]);
  };

  const handleSubjectUpdateWizardDone = (updatedSubject: SubjectRow | null) => {
    setPendingSubjectUpdate(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: updatedSubject
          ? `Το μάθημα "${updatedSubject.name}" ενημερώθηκε ✅`
          : 'Η ενημέρωση του μαθήματος απέτυχε.',
      },
    ]);
  };

  const handleSubjectTutorWizardDone = (assignedNames: string[] | null) => {
    setPendingSubjectTutors(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text:
          assignedNames === null
            ? 'Η ενημέρωση καθηγητών απέτυχε.'
            : assignedNames.length > 0
              ? `Καθηγητές ενημερώθηκαν: ${assignedNames.join(', ')} ✅`
              : 'Οι καθηγητές αφαιρέθηκαν ✅',
      },
    ]);
  };

  const handleStudentWizardDone = (createdStudent: CreatedStudent | null) => {
    setPendingStudent(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: createdStudent
          ? `Ο μαθητής "${createdStudent.full_name}" δημιουργήθηκε ✅`
          : 'Η δημιουργία του μαθητή απέτυχε.',
      },
    ]);
  };

  const handleStudentUpdateWizardDone = (updatedStudent: CreatedStudent | null) => {
    setPendingStudentUpdate(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: updatedStudent
          ? `Το επίπεδο του μαθητή "${updatedStudent.full_name}" ενημερώθηκε ✅`
          : 'Η ενημέρωση του μαθητή απέτυχε.',
      },
    ]);
  };

  const bubbleUser = 'bg-[color:var(--color-accent)] text-white';
  const bubbleAssistant = isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800';

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden border-l shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40">
            <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Kika</p>
            <p className="text-[10px] text-white/70">AI Βοηθός</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewChat}
            aria-label="Νέα συνομιλία"
            title="Νέα συνομιλία"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Κλείσιμο"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1">
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Γεια σου! Είμαι η Kika 👋</p>
              <p className={`mx-auto max-w-[260px] text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Πες μου τι χρειάζεσαι για το φροντιστήριο και θα σε βοηθήσω.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInput('Πρόσθεσε νέο μαθητή Γιώργο Παπαδόπουλο, τηλέφωνο 6900000000')}
              className={`mt-1 max-w-full truncate rounded-full border px-3 py-1.5 text-[11px] transition ${
                isDark
                  ? 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-[#7C3AED]/50 hover:text-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-[#7C3AED]/50 hover:text-slate-700'
              }`}
            >
              "Πρόσθεσε νέο μαθητή Γιώργο Παπαδόπουλο, τηλέφωνο 6900000000"
            </button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
                <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? bubbleUser : bubbleAssistant}`}>
              {m.text}
            </div>
            {m.role === 'user' && (
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`}>
                <User className={`h-4 w-4 ${isDark ? 'text-slate-200' : 'text-slate-600'}`} />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <div className={`flex items-center gap-1 rounded-xl px-3 py-3 ${bubbleAssistant}`}>
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '0.15s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.30s' }} />
            </div>
          </div>
        )}
        {pendingClassTitle && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <ClassCreationWizard
              mode="create"
              title={pendingClassTitle}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleClassWizardDone}
            />
          </div>
        )}
        {pendingClassUpdate && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <ClassCreationWizard
              mode="update"
              classId={pendingClassUpdate.classId}
              title={pendingClassUpdate.title}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleClassUpdateWizardDone}
            />
          </div>
        )}
        {pendingStudent && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <StudentLevelWizard
              mode="create"
              student={pendingStudent}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleStudentWizardDone}
            />
          </div>
        )}
        {pendingStudentUpdate && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <StudentLevelWizard
              mode="update"
              student={pendingStudentUpdate}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleStudentUpdateWizardDone}
            />
          </div>
        )}
        {pendingTutorSpecialty && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <TutorSpecialtyWizard
              tutorId={pendingTutorSpecialty.tutorId}
              tutorName={pendingTutorSpecialty.tutorName}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleTutorSpecialtyWizardDone}
            />
          </div>
        )}
        {pendingSubjectName && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <SubjectLevelWizard
              mode="create"
              name={pendingSubjectName}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleSubjectWizardDone}
            />
          </div>
        )}
        {pendingSubjectDisambiguation && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <div className={`max-w-[85%] space-y-2 rounded-xl border px-3 py-3 text-sm ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                Βρέθηκαν περισσότερα από ένα μαθήματα «{pendingSubjectDisambiguation.subjectName}» — επίλεξε ποιο εννοείς:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pendingSubjectDisambiguation.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePickAmbiguousSubject(c, pendingSubjectDisambiguation.next)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      isDark
                        ? 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-[#7C3AED]/50'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#7C3AED]/50'
                    }`}
                  >
                    {c.name}{c.level_name ? ` (${c.level_name})` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {pendingSubjectUpdate && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <SubjectLevelWizard
              mode="update"
              subjectId={pendingSubjectUpdate.subjectId}
              name={pendingSubjectUpdate.name}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleSubjectUpdateWizardDone}
            />
          </div>
        )}
        {pendingSubjectTutors && schoolId && (
          <div className="flex items-end gap-2 justify-start">
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
              <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
            </div>
            <SubjectTutorWizard
              subjectId={pendingSubjectTutors.subjectId}
              subjectName={pendingSubjectTutors.subjectName}
              schoolId={schoolId}
              isDark={isDark}
              onDone={handleSubjectTutorWizardDone}
            />
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t px-3 py-3" style={{ borderColor: isDark ? 'rgb(51 65 85 / 0.6)' : 'rgb(226 232 240)' }}>
        <textarea
          ref={textareaRef}
          rows={1}
          className={`flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] ${isDark ? 'border-[#7C3AED]/40 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-[#7C3AED]/40 bg-slate-50 text-slate-800 placeholder-slate-400'}`}
          style={{ minHeight: '36px', maxHeight: '120px', overflowY: 'auto' }}
          placeholder="Γράψε ένα μήνυμα..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={handleTextareaInput}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
