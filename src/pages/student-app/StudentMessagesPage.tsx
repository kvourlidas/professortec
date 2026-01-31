import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Search, RefreshCw, MessageSquareText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient'; // adjust if needed

type StudentRow = {
  id: string;
  full_name: string | null;
};

type ThreadRow = {
  id: string;
  school_id: string;
  student_id: string;
};

type MsgRow = {
  id: string;
  body: string;
  sender_role: 'student' | 'school';
  created_at: string;
};

type UnreadRow = {
  student_id: string;
  thread_id: string;
  unread_count: number;
};

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

  // ✅ unread map: student_id -> count
  const [unreadByStudent, setUnreadByStudent] = useState<Record<string, number>>({});

  const listEndRef = useRef<HTMLDivElement | null>(null);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.full_name ?? '').toLowerCase().includes(q));
  }, [students, query]);

  // ✅ sort by unread desc, then name
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

  const canSend = useMemo(() => {
    return draft.trim().length > 0 && !sending && !!activeThread;
  }, [draft, sending, activeThread]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const loadUnreadCounts = async () => {
    try {
      const { data, error } = await supabase.rpc('school_get_unread_counts');
      if (error) throw error;

      const map: Record<string, number> = {};
      (data ?? []).forEach((r: UnreadRow) => {
        map[r.student_id] = Number(r.unread_count ?? 0);
      });

      setUnreadByStudent(map);
    } catch (e) {
      console.error('loadUnreadCounts error:', e);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStudents((data ?? []) as StudentRow[]);
    } catch (e) {
      console.error('loadStudents error:', e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const openStudentChat = async (student: StudentRow) => {
    setActiveStudent(student);
    setLoadingChat(true);
    setMessages([]);
    setDraft('');
    try {
      const { data: threadId, error: tErr } = await supabase.rpc('school_get_or_create_thread', {
        p_student_id: student.id,
      });
      if (tErr) throw tErr;

      const tid = typeof threadId === 'string' ? threadId : (threadId as any);
      if (!tid) throw new Error('No thread id returned');

      const { data: mt, error: mtErr } = await supabase
        .from('message_threads')
        .select('id, school_id, student_id')
        .eq('id', tid)
        .maybeSingle();

      if (mtErr || !mt) throw mtErr ?? new Error('Thread not found');

      const threadMeta: ThreadRow = {
        id: mt.id,
        school_id: mt.school_id,
        student_id: mt.student_id,
      };
      setActiveThread(threadMeta);

      // ✅ mark student messages read (for school)
      await supabase.rpc('school_mark_thread_read', { p_thread_id: tid });

      const { data: msgs, error: mErr } = await supabase
        .from('messages')
        .select('id, body, sender_role, created_at')
        .eq('thread_id', tid)
        .order('created_at', { ascending: true });

      if (mErr) throw mErr;
      setMessages((msgs ?? []) as MsgRow[]);
      scrollToBottom();

      // ✅ refresh unread badges
      await loadUnreadCounts();
    } catch (e) {
      console.error('openStudentChat error:', e);
    } finally {
      setLoadingChat(false);
    }
  };

  const refreshChat = async () => {
    if (!activeThread) return;
    setLoadingChat(true);
    try {
      await supabase.rpc('school_mark_thread_read', { p_thread_id: activeThread.id });

      const { data: msgs, error } = await supabase
        .from('messages')
        .select('id, body, sender_role, created_at')
        .eq('thread_id', activeThread.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((msgs ?? []) as MsgRow[]);
      scrollToBottom();

      // ✅ refresh unread badges
      await loadUnreadCounts();
    } catch (e) {
      console.error('refreshChat error:', e);
    } finally {
      setLoadingChat(false);
    }
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeThread || sending) return;

    setSending(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

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
      // unread counts may change if student replied elsewhere; keep fresh
      await loadUnreadCounts();
    } catch (e) {
      console.error('sendMessage error:', e);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadStudents();
    loadUnreadCounts();

    // ✅ auto refresh unread counts every 12s
    const t = setInterval(() => {
      loadUnreadCounts();
    }, 12000);

    return () => clearInterval(t);
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      <div style={styles.shell}>
        {/* LEFT */}
        <div style={styles.leftPanel}>
          <div style={styles.leftHeader}>
            <div style={styles.leftTitleRow}>
              <div style={styles.iconBadge}>
                <MessageSquareText size={16} />
              </div>
              <div style={{ fontWeight: 950 }}>Μηνύματα</div>
            </div>
            <div style={styles.leftSubtitle}>Επίλεξε μαθητή για συνομιλία</div>
          </div>

          <div style={styles.searchWrap}>
            <Search size={16} style={{ opacity: 0.8 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση μαθητή…"
              style={styles.searchInput}
            />
          </div>

          <div style={styles.list}>
            {loadingStudents ? (
              <div style={styles.mutedLine}>Φόρτωση…</div>
            ) : sortedStudents.length === 0 ? (
              <div style={styles.mutedLine}>Δεν βρέθηκαν μαθητές</div>
            ) : (
              sortedStudents.map((s) => {
                const active = activeStudent?.id === s.id;
                const unread = unreadByStudent[s.id] ?? 0;

                return (
                  <button
                    key={s.id}
                    onClick={() => openStudentChat(s)}
                    style={{
                      ...styles.studentBtn,
                      ...(active ? styles.studentBtnActive : null),
                    }}
                  >
                    <div style={styles.avatar}>
                      {(s.full_name?.trim()?.[0] ?? 'Μ').toUpperCase()}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={styles.studentName}>{s.full_name ?? '—'}</div>
                      {/* ✅ removed "Πάτα για άνοιγμα" */}
                      <div style={styles.studentMeta}>{active ? 'Ανοιχτή συνομιλία' : ''}</div>
                    </div>

                    {/* ✅ Unread badge */}
                    {unread > 0 ? (
                      <div style={styles.unreadBadge} title={`${unread} μη αναγνωσμένα`}>
                        <span style={styles.unreadDot} />
                        <span style={styles.unreadCount}>{unread}</span>
                      </div>
                    ) : (
                      <div style={{ width: 44 }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div style={styles.rightPanel}>
          <div style={styles.chatHeader}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.chatTitle}>
                {activeStudent ? `Συνομιλία: ${activeStudent.full_name ?? '—'}` : 'Επίλεξε μαθητή'}
              </div>
              <div style={styles.chatSubtitle}>
              </div>
            </div>

            {/* ✅ Icon-only refresh */}
            <button
              onClick={refreshChat}
              disabled={!activeThread || loadingChat}
              style={{
                ...styles.refreshIconBtn,
                opacity: !activeThread || loadingChat ? 0.5 : 1,
                cursor: !activeThread || loadingChat ? 'not-allowed' : 'pointer',
              }}
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div style={styles.messagesArea}>
            {!activeThread ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>Άνοιξε μια συνομιλία</div>
                <div style={styles.emptyText}>
                  Επίλεξε έναν μαθητή από την αριστερή λίστα για να δεις και να απαντήσεις στα μηνύματα.
                </div>
              </div>
            ) : loadingChat ? (
              <div style={styles.mutedLine}>Φόρτωση συνομιλίας…</div>
            ) : messages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>Δεν υπάρχουν μηνύματα</div>
                <div style={styles.emptyText}>Στείλε το πρώτο μήνυμα από κάτω.</div>
              </div>
            ) : (
              <>
                {messages.map((m) => {
                  const mine = m.sender_role === 'school';
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          ...styles.bubble,
                          ...(mine ? styles.bubbleMine : styles.bubbleTheirs),
                        }}
                      >
                        <div style={styles.bubbleText}>{m.body}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEndRef} />
              </>
            )}
          </div>

          <div style={styles.composerWrap}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Γράψε μήνυμα…"
              disabled={!activeThread}
              style={{
                ...styles.composerInput,
                opacity: activeThread ? 1 : 0.5,
              }}
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
              style={{
                ...styles.sendBtn,
                opacity: canSend ? 1 : 0.45,
                cursor: canSend ? 'pointer' : 'not-allowed',
              }}
              title="Send"
            >
              <Send size={18} />
            </button>
          </div>

          <div style={styles.helperText}>
            Tip: <b>Enter</b> για αποστολή • <b>Shift+Enter</b> για νέα γραμμή
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    padding: 18,
  },
  bgGlow1: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(900px 500px at 20% 0%, rgba(59,130,246,0.22), transparent 55%)',
    pointerEvents: 'none',
  },
  bgGlow2: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(900px 500px at 90% 25%, rgba(99,102,241,0.16), transparent 55%)',
    pointerEvents: 'none',
  },
  shell: {
    position: 'relative',
    display: 'flex',
    height: 'calc(100vh - 120px)',
    gap: 12,
  },
  leftPanel: {
    width: 340,
    minWidth: 300,
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.035)',
    boxShadow: '0 18px 50px rgba(2,6,23,0.10)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    flex: 1,
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.035)',
    boxShadow: '0 18px 50px rgba(2,6,23,0.10)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  leftHeader: {
    padding: 14,
    borderBottom: '1px solid rgba(148,163,184,0.16)',
  },
  leftTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 15,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59,130,246,0.40)',
    background: 'rgba(59,130,246,0.10)',
    color: 'rgb(59,130,246)',
  },
  leftSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.7,
  },
  searchWrap: {
    margin: 12,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontWeight: 800,
    color: 'inherit',
  } as any,
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    paddingTop: 0,
  },
  studentBtn: {
    width: '100%',
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 160ms ease',
  },
  studentBtnActive: {
    border: '1px solid rgba(59,130,246,0.55)',
    background: 'rgba(59,130,246,0.10)',
    boxShadow: '0 10px 26px rgba(59,130,246,0.10)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.06)',
    flexShrink: 0,
  },
  studentName: {
    fontWeight: 900,
    fontSize: 13,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  studentMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.7,
    minHeight: 14, // keeps row height stable even when empty
  },

  // ✅ unread badge
  unreadBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(59,130,246,0.40)',
    background: 'rgba(59,130,246,0.12)',
    minWidth: 44,
    justifyContent: 'center',
    fontWeight: 950,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    background: 'rgba(59,130,246,0.95)',
    boxShadow: '0 0 0 4px rgba(59,130,246,0.12)',
  },
  unreadCount: {
    fontSize: 12,
    lineHeight: '12px',
  },

  chatHeader: {
    padding: 14,
    borderBottom: '1px solid rgba(148,163,184,0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chatTitle: {
    fontWeight: 950,
    fontSize: 15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chatSubtitle: { marginTop: 4, fontSize: 12, fontWeight: 700, opacity: 0.7 },

  // ✅ icon-only refresh button
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(255,255,255,0.05)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
  },
  emptyState: {
    border: '1px dashed rgba(148,163,184,0.25)',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(255,255,255,0.03)',
    maxWidth: 520,
  },
  emptyTitle: { fontWeight: 950, marginBottom: 6 },
  emptyText: { fontWeight: 700, opacity: 0.75, lineHeight: 1.35 },
  mutedLine: { opacity: 0.75, fontWeight: 800 },

  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.35,
  },
  // ✅ nicer message font (more “chat-like”)
  bubbleText: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    fontWeight: 650,
    fontSize: 14.5,
    letterSpacing: '0.2px',
    lineHeight: 1.5,
  },

  bubbleMine: {
    border: '1px solid rgba(59,130,246,0.55)',
    background: 'rgba(59,130,246,0.11)',
    boxShadow: '0 10px 26px rgba(59,130,246,0.08)',
  },
  bubbleTheirs: {
    border: '1px solid rgba(148,163,184,0.20)',
    background: 'rgba(15,23,42,0.04)',
  },

  composerWrap: {
    padding: 12,
    borderTop: '1px solid rgba(148,163,184,0.16)',
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
  },
  composerInput: {
    flex: 1,
    resize: 'none',
    height: 56,
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(30,41,59,0.85)',
    outline: 'none',
    fontWeight: 800,
    background: 'rgba(2,6,23,0.82)',
    color: '#fff',
  } as any,
  sendBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    border: '1px solid rgba(59,130,246,0.55)',
    background: 'rgba(59,130,246,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    padding: '0 14px 12px 14px',
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.65,
  },
};
