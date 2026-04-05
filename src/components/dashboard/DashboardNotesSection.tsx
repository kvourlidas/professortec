// src/components/dashboard/DashboardNotesSection.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabaseClient';
import { Palette, StickyNote, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Undo2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

type DashboardNote = {
  id: string; school_id: string; content: string; color: string;
  created_at: string | null; is_urgent: boolean;
};

const NOTE_COLORS = [
  { value: '#6366f1', label: 'Indigo'    },
  { value: '#0ea5e9', label: 'Μπλε'      },
  { value: '#06b6d4', label: 'Cyan'      },
  { value: '#10b981', label: 'Πράσινο'   },
  { value: '#f59e0b', label: 'Κίτρινο'   },
  { value: '#f97316', label: 'Πορτοκαλί' },
  { value: '#f43f5e', label: 'Κόκκινο'   },
  { value: '#a855f7', label: 'Μωβ'       },
];

const DEFAULT_NOTE_COLOR = '#3b82f6';
const NOTES_PER_PAGE = 3;

type DashboardNotesSectionProps = { schoolId: string | null };

export default function DashboardNotesSection({ schoolId }: DashboardNotesSectionProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<string>(DEFAULT_NOTE_COLOR);
  const [noteUrgent, setNoteUrgent] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesPage, setNotesPage] = useState(1);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteWrapRef = useRef<HTMLDivElement | null>(null);
  const palettePortalRef = useRef<HTMLDivElement | null>(null);
  const paletteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [palettePos, setPalettePos] = useState<{ bottom: number; left: number } | null>(null);

  const [notePaletteOpenId, setNotePaletteOpenId] = useState<string | null>(null);
  const notePaletteWrapRef = useRef<HTMLDivElement | null>(null);
  const notePalettePortalRef = useRef<HTMLDivElement | null>(null);
  const [notePalettePos, setNotePalettePos] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        paletteWrapRef.current && !paletteWrapRef.current.contains(target) &&
        (!palettePortalRef.current || !palettePortalRef.current.contains(target))
      ) setPaletteOpen(false);
      if (
        notePaletteWrapRef.current && !notePaletteWrapRef.current.contains(target) &&
        (!notePalettePortalRef.current || !notePalettePortalRef.current.contains(target))
      ) setNotePaletteOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPaletteOpen(false); setNotePaletteOpenId(null); } };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!schoolId) { setNotes([]); return; }
    const loadNotes = async () => {
      setNotesLoading(true);
      const { data, error } = await supabase.from('dashboard_notes').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
      if (error) { console.error(error); setNotes([]); } else { setNotes((data ?? []) as DashboardNote[]); }
      setNotesLoading(false); setNotesPage(1);
    };
    loadNotes();
  }, [schoolId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
    if (notesPage > totalPages) setNotesPage(totalPages);
  }, [notes.length, notesPage]);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
  }, [notes]);

  const totalNotesPages = Math.max(1, Math.ceil(sortedNotes.length / NOTES_PER_PAGE));
  const pageNotes = useMemo(() => {
    const start = (notesPage - 1) * NOTES_PER_PAGE;
    return sortedNotes.slice(start, start + NOTES_PER_PAGE);
  }, [sortedNotes, notesPage]);

  const handleAddNote = async () => {
    if (!schoolId) return;
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setNotesSaving(true);
    const { data, error } = await supabase.from('dashboard_notes').insert({ school_id: schoolId, content: trimmed, color: noteColor || DEFAULT_NOTE_COLOR, is_urgent: noteUrgent }).select().single();
    if (error) { console.error(error); } else if (data) { setNotes((prev) => [data as DashboardNote, ...prev]); setNoteText(''); setNoteUrgent(false); setNotesPage(1); }
    setNotesSaving(false);
  };

  const handleDeleteNote = async (id: string) => {
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== id));
    const { error } = await supabase.from('dashboard_notes').delete().eq('id', id);
    if (error) { console.error(error); setNotes(prev); }
  };

  const handleChangeNoteColor = async (id: string, color: string) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, color } : note)));
    const { error } = await supabase.from('dashboard_notes').update({ color }).eq('id', id);
    if (error) console.error(error);
  };

  const handleToggleUrgent = async (id: string, current: boolean) => {
    const prev = notes;
    setNotes((list) => list.map((note) => (note.id === id ? { ...note, is_urgent: !current } : note)));
    const { error } = await supabase.from('dashboard_notes').update({ is_urgent: !current }).eq('id', id);
    if (error) { console.error(error); setNotes(prev); }
  };

  // overflow-hidden added so rainbow line stays inside rounded corners
  const ColorPalette = ({ onSelect, onReset, currentColor }: { onSelect: (c: string) => void; onReset?: () => void; currentColor?: string }) => (
    <div className={`rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden ${
      isDark ? 'border-white/10 bg-slate-900/95' : 'border-slate-200 bg-white/95'
    }`} style={{ width: 216 }}>
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #6366f1, #f43f5e, #f97316, #a855f7)' }} />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Χρώμα</span>
        {onReset && (
          <button type="button" onClick={onReset}
            className={`text-[10px] transition hover:underline ${isDark ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            Επαναφορά
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2.5 px-4 pb-4">
        {NOTE_COLORS.map((c) => {
          const isActive = currentColor === c.value;
          return (
            <button key={c.value} type="button" onClick={() => onSelect(c.value)}
              aria-label={c.label} title={c.label}
              className="relative flex h-9 w-9 items-center justify-center rounded-[10px] transition-transform duration-100 hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${c.value}dd, ${c.value})`,
                boxShadow: isActive
                  ? `0 0 0 2px ${isDark ? '#0f172a' : '#fff'}, 0 0 0 4px ${c.value}, 0 4px 12px ${c.value}80`
                  : `0 3px 8px ${c.value}55`,
              }}>
              {isActive && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="flex flex-col flex-1">
      {/* Card */}
      <div className={`flex flex-col flex-1 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
        isDark
          ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
          : 'border-slate-200 bg-white/80 ring-black/[0.02]'
      }`}>
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header — inside card */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <StickyNote className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Σημειώσεις</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${
            isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'
          }`}>
            {notes.length} συνολικά
          </span>
        </div>

        {/* Add note form */}
        <div className="p-4">
          <textarea
            className={`w-full resize-none rounded-xl border px-3.5 py-2.5 text-xs placeholder outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]'
                : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
            }`}
            rows={3}
            placeholder="Γράψε μια σημείωση για σήμερα…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {/* Color picker */}
            <div ref={paletteWrapRef} className="relative">
              <button ref={paletteButtonRef} type="button" onClick={() => {
                if (paletteButtonRef.current) {
                  const r = paletteButtonRef.current.getBoundingClientRect();
                  setPalettePos({ bottom: window.innerHeight - r.top + 8, left: r.left });
                }
                setPaletteOpen((v) => !v);
              }}
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                  isDark
                    ? 'border-slate-700/60 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-700/60'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                aria-haspopup="dialog" aria-expanded={paletteOpen}>
                <Palette className="h-3 w-3" />
                <span>Χρώμα</span>
                <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: noteColor || DEFAULT_NOTE_COLOR }} />
              </button>
            </div>
            {paletteOpen && palettePos && createPortal(
              <div ref={palettePortalRef} style={{ position: 'fixed', bottom: palettePos.bottom, left: palettePos.left, zIndex: 9999 }}>
                <ColorPalette currentColor={noteColor} onSelect={(c) => { setNoteColor(c); setPaletteOpen(false); }} onReset={() => { setNoteColor(DEFAULT_NOTE_COLOR); setPaletteOpen(false); }} />
              </div>,
              document.body
            )}

            {/* Urgent toggle */}
            <button type="button" onClick={() => setNoteUrgent((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                noteUrgent
                  ? 'border-red-500/50 bg-red-500/10 text-red-200'
                  : isDark
                  ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
              aria-pressed={noteUrgent}>
              <AlertTriangle className="h-3 w-3" />
              Επείγον
            </button>

            {/* Add button */}
            <button type="button" onClick={handleAddNote} disabled={notesSaving || !noteText.trim()}
              className="btn-primary ml-auto gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
              {notesSaving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση…</> : 'Προσθήκη'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className={`border-t ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
          {notesLoading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση σημειώσεων…</span>
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
                <StickyNote className={`h-5 w-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν ακόμη σημειώσεις.</p>
            </div>
          ) : (
            <>
              <ol className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`} start={(notesPage - 1) * NOTES_PER_PAGE + 1}>
                {pageNotes.map((note) => {
                  const paletteOpenForThis = notePaletteOpenId === note.id;
                  return (
                    <li key={note.id} className={`group relative flex gap-3 px-4 py-3.5 transition ${
                      note.is_urgent
                        ? isDark ? 'bg-red-950/20 hover:bg-red-950/30' : 'bg-red-50/60 hover:bg-red-50'
                        : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/60'
                    }`}>
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-white/10" style={{ backgroundColor: note.color }} />
                      <div className="min-w-0 flex-1">
                        <p className={`whitespace-pre-wrap text-xs leading-relaxed ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{note.content}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button type="button" onClick={() => handleToggleUrgent(note.id, note.is_urgent)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
                              note.is_urgent
                                ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                                : isDark
                                ? 'border-slate-700/60 text-slate-500 hover:border-red-500/30 hover:text-red-300'
                                : 'border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500'
                            }`}>
                            {note.is_urgent
                              ? <><Undo2 className="h-2.5 w-2.5" />Αναίρεση επείγον</>
                              : <><AlertTriangle className="h-2.5 w-2.5" />Επείγον</>}
                          </button>
                          <div ref={paletteOpenForThis ? notePaletteWrapRef : null} className="relative">
                            <button type="button"
                              onClick={(e) => {
                                const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setNotePalettePos({ bottom: window.innerHeight - r.top + 8, left: r.left });
                                setNotePaletteOpenId((curr) => curr === note.id ? null : note.id);
                              }}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                                isDark
                                  ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                                  : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                              }`}
                              title="Αλλαγή χρώματος" aria-haspopup="dialog" aria-expanded={paletteOpenForThis}>
                              <Palette className="h-3 w-3" />
                            </button>
                          </div>
                          {paletteOpenForThis && notePalettePos && createPortal(
                            <div ref={notePalettePortalRef} style={{ position: 'fixed', bottom: notePalettePos.bottom, left: notePalettePos.left, zIndex: 9999 }}>
                              <ColorPalette currentColor={note.color} onSelect={(c) => { handleChangeNoteColor(note.id, c); setNotePaletteOpenId(null); }} />
                            </div>,
                            document.body
                          )}
                          <button type="button" onClick={() => handleDeleteNote(note.id)}
                            className={`ml-auto rounded-lg border border-transparent px-2 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100 ${
                              isDark
                                ? 'text-slate-600 hover:border-red-500/30 hover:text-red-300'
                                : 'text-slate-400 hover:border-red-200 hover:text-red-500'
                            }`}>
                            Διαγραφή
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {totalNotesPages > 1 && (
                <div className={`flex items-center justify-between border-t px-4 py-2.5 ${
                  isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'
                }`}>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Σελίδα <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{notesPage}</span> από <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{totalNotesPages}</span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setNotesPage((p) => Math.max(1, p - 1))} disabled={notesPage === 1}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        isDark
                          ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setNotesPage((p) => Math.min(totalNotesPages, p + 1))} disabled={notesPage === totalNotesPages}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        isDark
                          ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                      }`}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}