import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Search, RefreshCw, MessageSquareText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth';

type StudentRow = { id: string; full_name: string | null };
type ThreadRow = { id: string; school_id: string; student_id: string };
type MsgRow = { id: string; body: string; sender_role: 'student' | 'school'; created_at: string };
type UnreadRow = { student_id: string; thread_id: string; unread_count: number };

export default function StudentMessagesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { profile } = useAuth();
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchoolName = async () => {
      if (!profile?.school_id) return;
      const { data } = await supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle();
      if (data?.name) setSchoolName(data.name);
    };
    fetchSchoolName();
  }, [profile?.school_id]);

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState('');

  const [activeStudent, setActiveStudent] = useState<StudentRow | null>(null);
  const [activeThread, setActiveThread] = useState<ThreadRow | null>(null);

  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [unreadByStudent, setUnreadByStudent] = useState<Record<string, number>>({});

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'instant') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({ behavior });
      });
    });
  };

  // Fire scroll after messages actually render
  useEffect(() => {
    if (pendingScrollRef.current && messages.length > 0) {
      pendingScrollRef.current = false;
      scrollToBottom('instant');
    }
  }, [messages]);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.full_name ?? '').toLowerCase().includes(q));
  }, [students, query]);

  const sortedStudents = useMemo(() => {
    const arr = [...filteredStudents];
    arr.sort((a, b) => {
      const au = unreadByStudent[a.id] ?? 0;
      const bu = unreadByStudent[b.id] ?? 0;
      if (bu !== au) return bu - au;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });
    return arr;
  }, [filteredStudents, unreadByStudent]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending && !!activeThread, [draft, sending, activeThread]);

  const [refreshing, setRefreshing] = useState(false);

  const manualRefresh = async () => {
    if (!activeThread || refreshing) return;
    setRefreshing(true);
    await refreshChat();
    setRefreshing(false);
  };

  const loadUnreadCounts = async () => {
    try {
      const { data, error } = await supabase.rpc('school_get_unread_counts');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: UnreadRow) => { map[r.student_id] = Number(r.unread_count ?? 0); });
      setUnreadByStudent(map);
    } catch (e) { console.error('loadUnreadCounts error:', e); }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase.from('students').select('id, full_name').order('full_name', { ascending: true });
      if (error) throw error;
      setStudents((data ?? []) as StudentRow[]);
    } catch (e) { console.error('loadStudents error:', e); }
    finally { setLoadingStudents(false); }
  };

  const openStudentChat = async (student: StudentRow) => {
    setActiveStudent(student);
    setLoadingChat(true);
    setMessages([]);
    setDraft('');
    try {
      const { data: threadId, error: tErr } = await supabase.rpc('school_get_or_create_thread', { p_student_id: student.id });
      if (tErr) throw tErr;
      const tid = typeof threadId === 'string' ? threadId : (threadId as any);
      if (!tid) throw new Error('No thread id returned');
      const { data: mt, error: mtErr } = await supabase.from('message_threads').select('id, school_id, student_id').eq('id', tid).maybeSingle();
      if (mtErr || !mt) throw mtErr ?? new Error('Thread not found');
      setActiveThread({ id: mt.id, school_id: mt.school_id, student_id: mt.student_id });
      await supabase.rpc('school_mark_thread_read', { p_thread_id: tid });
      const { data: msgs, error: mErr } = await supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', tid).order('created_at', { ascending: true });
      if (mErr) throw mErr;
      setMessages((msgs ?? []) as MsgRow[]);
      pendingScrollRef.current = true;
      await loadUnreadCounts();
      scrollToBottom('instant');
    } catch (e) { console.error('openStudentChat error:', e); }
    finally { setLoadingChat(false); }
  };

  const refreshChat = async () => {
    if (!activeThread) return;
    try {
      await supabase.rpc('school_mark_thread_read', { p_thread_id: activeThread.id });
      const { data: msgs, error } = await supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', activeThread.id).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((msgs ?? []) as MsgRow[]);
      pendingScrollRef.current = true;
      scrollToBottom('instant');
      await loadUnreadCounts();
    } catch (e) { console.error('refreshChat error:', e); }
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeThread || sending) return;
    setSending(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = user?.id;
      if (!uid) throw new Error('No auth user');
      const { error } = await supabase.from('messages').insert({
        thread_id: activeThread.id,
        school_id: activeThread.school_id,
        student_id: activeThread.student_id,
        sender_role: 'school',
        sender_user_id: uid,
        body,
      });
      if (error) throw error;
      setDraft('');
      await refreshChat();
      await loadUnreadCounts();
    } catch (e) { console.error('sendMessage error:', e); }
    finally { setSending(false); }
  };

  useEffect(() => {
    loadStudents();
    loadUnreadCounts();
    const t = setInterval(() => { loadUnreadCounts(); }, 12000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Σήμερα';
      return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: MsgRow[] }[] = [];
    messages.forEach((m) => {
      const d = formatDate(m.created_at);
      const last = groups[groups.length - 1];
      if (!last || last.date !== d) groups.push({ date: d, msgs: [m] });
      else last.msgs.push(m);
    });
    return groups;
  }, [messages]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const scrollStyle: React.CSSProperties = {
    scrollbarWidth: 'thin',
    scrollbarColor: isDark ? 'rgba(71,85,105,0.35) transparent' : 'rgba(203,213,225,0.7) transparent',
  };

  const divider = isDark ? 'border-slate-700/50' : 'border-slate-100';

  return (
    <div
      className={`flex overflow-hidden ${isDark ? 'bg-[#111827]' : 'bg-white'}`}
      style={{ margin: '-24px -16px', height: 'calc(100vh - 0px)', maxHeight: '100vh' }}
    >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className={[
          'flex w-64 shrink-0 flex-col border-r',
          divider,
          isDark ? 'bg-[#111827]' : 'bg-slate-50',
        ].join(' ')}>

          {/* Header */}
          <div className={`border-b px-4 py-3 ${divider}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Μηνύματα
            </p>
          </div>

          {/* Search */}
          <div className={`border-b px-3 py-2 ${divider}`}>
            <div className="relative">
              <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση…"
                className={[
                  'h-7 w-full rounded-lg pl-7 pr-3 text-[11px] outline-none transition',
                  isDark
                    ? 'bg-slate-900/80 text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                    : 'border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-[color:var(--color-accent)]/20',
                ].join(' ')}
              />
            </div>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto py-1" style={scrollStyle}>
            {loadingStudents ? (
              <div className="flex justify-center py-10">
                <Loader2 className={`h-3.5 w-3.5 animate-spin ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
            ) : sortedStudents.length === 0 ? (
              <p className={`py-10 text-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν βρέθηκαν</p>
            ) : (
              sortedStudents.map((s) => {
                const active = activeStudent?.id === s.id;
                const unread = unreadByStudent[s.id] ?? 0;
                const initial = (s.full_name?.trim()?.[0] ?? 'Μ').toUpperCase();

                return (
                  <button
                    key={s.id}
                    onClick={() => openStudentChat(s)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      active
                        ? isDark ? 'bg-white/[0.05]' : 'bg-white'
                        : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-white/80',
                    ].join(' ')}
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={
                        active
                          ? { background: 'var(--color-accent)', color: isDark ? '#000' : '#fff' }
                          : { background: isDark ? '#1a2234' : '#e2e8f0', color: isDark ? '#64748b' : '#94a3b8' }
                      }
                    >
                      {initial}
                    </div>

                    {/* Name */}
                    <span className={[
                      'flex-1 truncate text-[12px]',
                      active
                        ? isDark ? 'font-semibold text-slate-100' : 'font-semibold text-slate-800'
                        : isDark ? 'text-slate-500' : 'text-slate-500',
                    ].join(' ')}>
                      {s.full_name ?? '—'}
                    </span>

                    {/* Unread badge */}
                    {unread > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat panel ──────────────────────────────────────────────── */}
        <div className={`flex flex-1 flex-col ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>

          {/* Header */}
          <div className={`flex h-11 shrink-0 items-center justify-between border-b px-5 ${divider}`}>
            {activeStudent ? (
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--color-accent)', color: isDark ? '#000' : '#fff' }}
                >
                  {(activeStudent.full_name?.trim()?.[0] ?? 'Μ').toUpperCase()}
                </div>
                <span className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {activeStudent.full_name ?? '—'}
                </span>
              </div>
            ) : (
              <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Επίλεξε μαθητή</span>
            )}

            <button
              onClick={manualRefresh}
              disabled={!activeThread || refreshing}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-25 ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={scrollStyle}>
            {!activeThread ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <MessageSquareText className={`h-7 w-7 ${isDark ? 'text-slate-800' : 'text-slate-300'}`} />
                <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Επίλεξε μαθητή για να δεις τη συνομιλία
                </p>
              </div>
            ) : loadingChat ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className={`h-4 w-4 animate-spin ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Δεν υπάρχουν μηνύματα ακόμα.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupedMessages.map((group) => (
                  <div key={group.date} className="flex flex-col gap-1">

                    {/* Date separator */}
                    <div className="flex items-center gap-3 py-1">
                      <div className={`h-px flex-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`} />
                      <span className={`text-[10px] ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>{group.date}</span>
                      <div className={`h-px flex-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`} />
                    </div>

                    {/* Bubbles */}
                    {group.msgs.map((m, i) => {
                      const mine = m.sender_role === 'school';
                      const sameSenderAsPrev = i > 0 && group.msgs[i - 1].sender_role === m.sender_role;
                      const sameSenderAsNext = i < group.msgs.length - 1 && group.msgs[i + 1].sender_role === m.sender_role;
                      const isLastInRun = !sameSenderAsNext;

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${sameSenderAsPrev ? 'mt-0.5' : 'mt-2.5'}`}
                        >
                          {/* Student avatar - left side, only on last in run */}
                          {!mine && (
                            <div className="w-6 shrink-0 mb-0.5">
                              {isLastInRun ? (
                                <div
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                                  style={{ background: isDark ? '#1e293b' : '#e2e8f0', color: isDark ? '#94a3b8' : '#64748b' }}
                                >
                                  {(activeStudent?.full_name?.trim()?.[0] ?? 'Μ').toUpperCase()}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="flex flex-col">
                            {/* Time label on first bubble of a run */}
                            {!sameSenderAsPrev && (
                              <span className={`mb-1 px-1 text-[10px] ${mine ? 'text-right' : 'text-left'} ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
                                {formatTime(m.created_at)}
                              </span>
                            )}
                            <div
                              className={[
                                'max-w-[340px] break-words rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
                                mine
                                  ? 'rounded-br-sm'
                                  : isDark
                                  ? 'rounded-bl-sm bg-[#1e293b] text-slate-200'
                                  : 'rounded-bl-sm bg-slate-100 text-slate-700',
                              ].join(' ')}
                              style={mine ? { background: 'var(--color-accent)', color: isDark ? '#000' : '#fff' } : {}}
                            >
                              {m.body}
                            </div>
                          </div>

                          {/* School avatar - right side, only on last in run */}
                          {mine && (
                            <div className="w-6 shrink-0 mb-0.5">
                              {isLastInRun ? (
                                <div
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                                  style={{ background: isDark ? '#1e293b' : '#e2e8f0', color: 'var(--color-accent)' }}
                                >
                                  {(schoolName?.trim()?.[0] ?? 'Σ').toUpperCase()}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* Scroll anchor */}
                <div ref={listEndRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className={`border-t px-4 py-3 ${divider}`}>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeThread ? 'Γράψε μήνυμα…' : 'Επίλεξε μαθητή…'}
                disabled={!activeThread}
                rows={2}
                className={[
                  'flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed outline-none transition disabled:cursor-not-allowed disabled:opacity-30',
                  isDark
                    ? 'bg-[#1e293b] text-slate-100 placeholder-slate-500 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                    : 'border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-[color:var(--color-accent)]/20',
                ].join(' ')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                style={{
                  background: canSend ? 'var(--color-accent)' : isDark ? '#1a2234' : '#e2e8f0',
                }}
              >
                {sending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: isDark ? '#475569' : '#94a3b8' }} />
                  : <Send className="h-3.5 w-3.5" style={{ color: canSend ? (isDark ? '#000' : '#fff') : isDark ? '#334155' : '#94a3b8' }} />
                }
              </button>
            </div>
            <p className={`mt-1.5 text-[10px] ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
              Enter αποστολή · Shift+Enter νέα γραμμή
            </p>
          </div>
        </div>
    </div>
  );
}