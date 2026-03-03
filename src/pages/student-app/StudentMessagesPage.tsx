import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Search, RefreshCw, MessageSquareText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

type StudentRow = { id: string; full_name: string | null };
type ThreadRow = { id: string; school_id: string; student_id: string };
type MsgRow = { id: string; body: string; sender_role: 'student' | 'school'; created_at: string };
type UnreadRow = { student_id: string; thread_id: string; unread_count: number };

export default function StudentMessagesPage() {
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => { listEndRef.current?.scrollIntoView({ behavior: 'smooth' }); });
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
    setActiveStudent(student); setLoadingChat(true); setMessages([]); setDraft('');
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
      scrollToBottom();
      await loadUnreadCounts();
    } catch (e) { console.error('openStudentChat error:', e); }
    finally { setLoadingChat(false); }
  };

  const refreshChat = async () => {
    if (!activeThread) return;
    setLoadingChat(true);
    try {
      await supabase.rpc('school_mark_thread_read', { p_thread_id: activeThread.id });
      const { data: msgs, error } = await supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', activeThread.id).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((msgs ?? []) as MsgRow[]);
      scrollToBottom();
      await loadUnreadCounts();
    } catch (e) { console.error('refreshChat error:', e); }
    finally { setLoadingChat(false); }
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
      const { error } = await supabase.from('messages').insert({ thread_id: activeThread.id, school_id: activeThread.school_id, student_id: activeThread.student_id, sender_role: 'school', sender_user_id: uid, body });
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

  // ── Format timestamp ──
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-3 px-1">

      {/* ── Left panel ── */}
      <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">

        {/* Header */}
        <div className="border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
              <MessageSquareText className="h-4 w-4 text-black" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-50">Μηνύματα</div>
              <div className="text-[10px] text-slate-500">Επίλεξε μαθητή για συνομιλία</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση μαθητή…"
              className="h-8 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto space-y-1 p-3">
          {loadingStudents ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              <span className="text-xs text-slate-500">Φόρτωση…</span>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Δεν βρέθηκαν μαθητές</div>
          ) : (
            sortedStudents.map((s) => {
              const active = activeStudent?.id === s.id;
              const unread = unreadByStudent[s.id] ?? 0;

              return (
                <button key={s.id} onClick={() => openStudentChat(s)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 shadow-sm'
                      : 'border-slate-700/50 bg-slate-900/20 hover:border-slate-600/60 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${
                    active
                      ? 'border-[color:var(--color-accent)]/40 text-[color:var(--color-accent)]'
                      : 'border-slate-700/60 text-slate-400'
                  }`}
                    style={active ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } : { background: 'rgba(15,23,42,0.4)' }}>
                    {(s.full_name?.trim()?.[0] ?? 'Μ').toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-100">{s.full_name ?? '—'}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500 min-h-[14px]">
                      {active ? 'Ανοιχτή συνομιλία' : ''}
                    </div>
                  </div>

                  {/* Unread badge */}
                  {unread > 0 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]" />
                      <span className="text-[10px] font-bold text-blue-300">{unread}</span>
                    </div>
                  ) : (
                    <div className="w-10" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">

        {/* Chat header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-50">
              {activeStudent ? `Συνομιλία: ${activeStudent.full_name ?? '—'}` : 'Επίλεξε μαθητή'}
            </div>
          </div>

          <button onClick={refreshChat} disabled={!activeThread || loadingChat}
            title="Ανανέωση" aria-label="Ανανέωση"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingChat ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeThread ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
                <MessageSquareText className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Άνοιξε μια συνομιλία</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Επίλεξε έναν μαθητή από την αριστερή λίστα για να δεις και να απαντήσεις στα μηνύματα.
                </p>
              </div>
            </div>
          ) : loadingChat ? (
            <div className="flex h-full items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-xs text-slate-500">Φόρτωση συνομιλίας…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-2xl border border-dashed border-slate-700/50 bg-white/[0.02] px-6 py-8">
                <p className="text-sm font-medium text-slate-200">Δεν υπάρχουν μηνύματα</p>
                <p className="mt-1 text-xs text-slate-500">Στείλε το πρώτο μήνυμα από κάτω.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {messages.map((m) => {
                const mine = m.sender_role === 'school';
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`group relative max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                      mine
                        ? 'border border-[color:var(--color-accent)]/30 shadow-sm'
                        : 'border border-slate-700/50 bg-slate-800/50'
                    }`}
                      style={mine ? { background: 'color-mix(in srgb, var(--color-accent) 12%, rgba(15,23,42,0.6))' } : {}}>
                      <p className="text-[13.5px] leading-relaxed text-slate-100 whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'text-right' : 'text-left'} text-slate-500`}>
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={listEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-700/60 px-4 py-3">
          <div className="flex items-end gap-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Γράψε μήνυμα…"
              disabled={!activeThread}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 disabled:opacity-40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) sendMessage();
                }
              }}
            />

            <button onClick={sendMessage} disabled={!canSend}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-accent)]/40 text-[color:var(--color-accent)] shadow-sm transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
              title="Αποστολή">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          <p className="mt-1.5 text-[10px] text-slate-600">
            <span className="font-semibold text-slate-500">Enter</span> για αποστολή · <span className="font-semibold text-slate-500">Shift+Enter</span> για νέα γραμμή
          </p>
        </div>
      </div>
    </div>
  );
}