// src/components/dashboard/DashboardNotesSection.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Palette } from 'lucide-react';

type DashboardNote = {
  id: string;
  school_id: string;
  content: string;
  color: string;
  created_at: string | null;
  is_urgent: boolean;
};

const NOTE_COLORS = [
  { value: '#f97316', label: 'Πορτοκαλί' },
  { value: '#3b82f6', label: 'Μπλε' },
  { value: '#22c55e', label: 'Πράσινο' },
  { value: '#eab308', label: 'Κίτρινο' },
  { value: '#f97373', label: 'Κόκκινο' },
];

const DEFAULT_NOTE_COLOR = '#3b82f6';
const NOTES_PER_PAGE = 5;

type DashboardNotesSectionProps = {
  schoolId: string | null;
};

export default function DashboardNotesSection({
  schoolId,
}: DashboardNotesSectionProps) {
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<string>(DEFAULT_NOTE_COLOR);
  const [noteUrgent, setNoteUrgent] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesPage, setNotesPage] = useState(1);

  // create-note palette popover
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteWrapRef = useRef<HTMLDivElement | null>(null);

  // per-note palette popover
  const [notePaletteOpenId, setNotePaletteOpenId] = useState<string | null>(
    null,
  );
  const notePaletteWrapRef = useRef<HTMLDivElement | null>(null);

  // close popovers on outside click / escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;

      const createWrap = paletteWrapRef.current;
      if (createWrap && !createWrap.contains(target)) {
        setPaletteOpen(false);
      }

      const perWrap = notePaletteWrapRef.current;
      if (perWrap && !perWrap.contains(target)) {
        setNotePaletteOpenId(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setNotePaletteOpenId(null);
      }
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Load notes
  useEffect(() => {
    if (!schoolId) {
      setNotes([]);
      return;
    }

    const loadNotes = async () => {
      setNotesLoading(true);
      const { data, error } = await supabase
        .from('dashboard_notes')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load dashboard notes', error);
        setNotes([]);
      } else {
        setNotes((data ?? []) as DashboardNote[]);
      }
      setNotesLoading(false);
      setNotesPage(1);
    };

    loadNotes();
  }, [schoolId]);

  // keep notesPage within range
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
    if (notesPage > totalPages) {
      setNotesPage(totalPages);
    }
  }, [notes.length, notesPage]);

  // urgent first, then newest first
  const sortedNotes = useMemo(() => {
    const clone = [...notes];
    clone.sort((a, b) => {
      if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return clone;
  }, [notes]);

  const totalNotesPages = Math.max(
    1,
    Math.ceil(sortedNotes.length / NOTES_PER_PAGE),
  );

  const pageNotes = useMemo(() => {
    const start = (notesPage - 1) * NOTES_PER_PAGE;
    return sortedNotes.slice(start, start + NOTES_PER_PAGE);
  }, [sortedNotes, notesPage]);

  const handleAddNote = async () => {
    if (!schoolId) return;
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setNotesSaving(true);
    const { data, error } = await supabase
      .from('dashboard_notes')
      .insert({
        school_id: schoolId,
        content: trimmed,
        color: noteColor || DEFAULT_NOTE_COLOR,
        is_urgent: noteUrgent,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert dashboard note', error);
    } else if (data) {
      setNotes((prev) => [data as DashboardNote, ...prev]);
      setNoteText('');
      setNoteUrgent(false);
      setNotesPage(1);
    }
    setNotesSaving(false);
  };

  const handleDeleteNote = async (id: string) => {
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== id));

    const { error } = await supabase.from('dashboard_notes').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete dashboard note', error);
      setNotes(prev);
    }
  };

  const handleChangeNoteColor = async (id: string, color: string) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, color } : note)),
    );

    const { error } = await supabase
      .from('dashboard_notes')
      .update({ color })
      .eq('id', id);

    if (error) {
      console.error('Failed to update note color', error);
    }
  };

  const handleToggleUrgent = async (id: string, current: boolean) => {
    const prev = notes;
    setNotes((list) =>
      list.map((note) =>
        note.id === id ? { ...note, is_urgent: !current } : note,
      ),
    );

    const { error } = await supabase
      .from('dashboard_notes')
      .update({ is_urgent: !current })
      .eq('id', id);

    if (error) {
      console.error('Failed to update note urgency', error);
      setNotes(prev);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-50">Σημειώσεις</h2>
        <span className="text-[11px] text-slate-400">{notes.length} συνολικά</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-4">
        {/* add note form */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <textarea
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/90 outline-none placeholder:text-white/35 focus:ring-1 focus:ring-[var(--color-accent)]/40"
            rows={3}
            placeholder="Γράψε μια σημείωση για σήμερα…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />

          <div className="flex flex-row md:flex-col gap-2 md:w-64 md:items-end">
            <div className="flex items-center gap-2 justify-between md:justify-end w-full">
              {/* ✅ NEW NOTE: palette button WITH text + dot preview (as you wanted) */}
              <div ref={paletteWrapRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPaletteOpen((v) => !v)}
                  className="
                    inline-flex items-center gap-2
                    rounded-xl px-3 py-2
                    border border-white/10 bg-white/[0.04]
                    text-[11px] text-white/80
                    hover:bg-white/[0.06] transition
                  "
                  aria-haspopup="dialog"
                  aria-expanded={paletteOpen}
                  title="Επιλογή χρώματος"
                >
                  <Palette size={14} className="text-white/70" />
                  <span>Χρώμα</span>
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-white/10"
                    style={{ backgroundColor: noteColor || DEFAULT_NOTE_COLOR }}
                    aria-hidden="true"
                  />
                </button>

                {paletteOpen && (
                  <div
                    className="
                      absolute right-0 z-50 mt-2 w-56
                      rounded-2xl border border-white/10
                      bg-[#0b1220]/95 backdrop-blur-xl
                      shadow-xl p-3
                    "
                    role="dialog"
                    aria-label="Επιλογή χρώματος σημείωσης"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold text-white/80">
                        Επιλογή χρώματος
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteColor(DEFAULT_NOTE_COLOR);
                          setPaletteOpen(false);
                        }}
                        className="text-[10px] text-white/55 hover:text-white/80 transition"
                        title="Επαναφορά σε μπλε"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setNoteColor(c.value);
                            setPaletteOpen(false);
                          }}
                          className="h-8 w-8 rounded-full border border-white/10 hover:ring-2 hover:ring-white/25 transition"
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          aria-label={c.label}
                        />
                      ))}
                    </div>

                    <div className="mt-2 text-[10px] text-white/45">
                      Default: Μπλε
                    </div>
                  </div>
                )}
              </div>

              {/* urgent toggle for new note */}
              <button
                type="button"
                onClick={() => setNoteUrgent((v) => !v)}
                className={`shrink-0 px-3 py-2 rounded-xl text-[11px] border transition ${
                  noteUrgent
                    ? 'border-red-400/70 bg-red-500/15 text-red-200 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]'
                    : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.06]'
                }`}
                aria-pressed={noteUrgent}
                title="Σήμανση ως επείγον"
              >
                Επείγον
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddNote}
              disabled={notesSaving || !noteText.trim()}
              className="
                w-full rounded-xl px-4 py-2 text-[11px] font-semibold
                bg-[var(--color-accent)] text-black
                hover:bg-[var(--color-accent)]/90 active:translate-y-[1px]
                transition
                disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0
                shadow-sm
              "
            >
              {notesSaving ? 'Αποθήκευση…' : 'Προσθήκη σημείωσης'}
            </button>
          </div>
        </div>

        {/* notes list */}
        <div className="border-t border-white/10 pt-3">
          {notesLoading ? (
            <p className="text-[11px] text-slate-300">Φόρτωση σημειώσεων…</p>
          ) : sortedNotes.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Δεν υπάρχουν ακόμη σημειώσεις για το σχολείο σας.
            </p>
          ) : (
            <>
              <ol
                className="space-y-2 text-[11px] list-decimal list-inside"
                start={(notesPage - 1) * NOTES_PER_PAGE + 1}
              >
                {pageNotes.map((note) => {
                  const paletteOpenForThis = notePaletteOpenId === note.id;

                  return (
                    <li
                      key={note.id}
                      className={`
                        group flex items-start gap-3 rounded-xl p-3
                        bg-white/[0.03] hover:bg-white/[0.05] transition
                        border
                        ${
                          note.is_urgent
                            ? 'border-red-400/80 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]'
                            : 'border-white/10'
                        }
                      `}
                    >
                      {/* dot only */}
                      <div
                        className="mt-[3px] h-3 w-3 rounded-full flex-shrink-0 border border-white/10"
                        style={{ backgroundColor: note.color }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="whitespace-pre-wrap text-slate-100 leading-relaxed">
                            {note.content}
                          </p>

                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 transition text-[10px] text-white/55 hover:text-red-300"
                            title="Διαγραφή"
                          >
                            Διαγραφή
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {note.is_urgent && (
                            <span className="text-[10px] px-2 py-[1px] rounded-full bg-red-500/15 text-red-200 border border-red-400/40">
                              Επείγον
                            </span>
                          )}

                          {/* urgent toggle for existing note */}
                          <button
                            type="button"
                            onClick={() => handleToggleUrgent(note.id, note.is_urgent)}
                            className={`
                              text-[10px] px-2 py-[1px] rounded-full border transition
                              ${
                                note.is_urgent
                                  ? 'border-red-400/50 text-red-200 hover:bg-red-500/10'
                                  : 'border-white/10 text-white/70 hover:border-red-400/30 hover:text-red-200'
                              }
                            `}
                          >
                            {note.is_urgent ? 'Αφαίρεση Επείγοντος' : 'Επείγον'}
                          </button>

                          {/* ✅ EXISTING NOTE: palette icon only (no text, no dot) */}
                          <div
                            ref={paletteOpenForThis ? notePaletteWrapRef : null}
                            className="relative"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setNotePaletteOpenId((curr) =>
                                  curr === note.id ? null : note.id,
                                )
                              }
                              className="
                                inline-flex items-center justify-center
                                h-6 w-6 rounded-lg
                                border border-white/10 bg-white/[0.04]
                                hover:bg-white/[0.06] transition
                              "
                              title="Αλλαγή χρώματος"
                              aria-haspopup="dialog"
                              aria-expanded={paletteOpenForThis}
                            >
                              <Palette size={13} className="text-white/65" />
                            </button>

                            {paletteOpenForThis && (
                              <div
                                className="
                                  absolute left-0 z-50 mt-2 w-52
                                  rounded-2xl border border-white/10
                                  bg-[#0b1220]/95 backdrop-blur-xl
                                  shadow-xl p-3
                                "
                                role="dialog"
                                aria-label="Αλλαγή χρώματος σημείωσης"
                              >
                                <div className="grid grid-cols-5 gap-2">
                                  {NOTE_COLORS.map((c) => (
                                    <button
                                      key={c.value}
                                      type="button"
                                      onClick={() => {
                                        handleChangeNoteColor(note.id, c.value);
                                        setNotePaletteOpenId(null);
                                      }}
                                      className="h-8 w-8 rounded-full border border-white/10 hover:ring-2 hover:ring-white/25 transition"
                                      style={{ backgroundColor: c.value }}
                                      title={c.label}
                                      aria-label={c.label}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {totalNotesPages > 1 && (
                <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-300">
                  <button
                    type="button"
                    onClick={() => setNotesPage((p) => Math.max(1, p - 1))}
                    disabled={notesPage === 1}
                    className="px-3 py-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Προηγούμενη
                  </button>
                  <span className="text-white/45">
                    Σελίδα {notesPage} από {totalNotesPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotesPage((p) => Math.min(totalNotesPages, p + 1))
                    }
                    disabled={notesPage === totalNotesPages}
                    className="px-3 py-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Επόμενη
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
