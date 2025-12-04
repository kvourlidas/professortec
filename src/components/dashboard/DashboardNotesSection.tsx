// src/components/dashboard/DashboardNotesSection.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

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

const NOTES_PER_PAGE = 5;

type DashboardNotesSectionProps = {
  schoolId: string | null;
};

export default function DashboardNotesSection({
  schoolId,
}: DashboardNotesSectionProps) {
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<string>(NOTE_COLORS[0].value);
  const [noteUrgent, setNoteUrgent] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesPage, setNotesPage] = useState(1);

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
      if (a.is_urgent !== b.is_urgent) {
        return a.is_urgent ? -1 : 1; // urgent first
      }
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da; // newest first
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
        color: noteColor,
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

    const { error } = await supabase
      .from('dashboard_notes')
      .delete()
      .eq('id', id);

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
      <h2 className="text-sm font-semibold text-slate-50">Σημειώσεις</h2>

      <div className="border border-slate-700 rounded-md bg-[color:var(--color-sidebar)] p-3 space-y-3">
        {/* add note form */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <textarea
            className="flex-1 rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] px-3 py-2 text-xs text-white outline-none"
            rows={2}
            placeholder="Γράψε μια σημείωση για σήμερα…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex flex-row md:flex-col gap-2 md:w-56">
            {/* colors + urgent */}
            <div className="flex items-center gap-2 justify-center md:justify-start">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNoteColor(c.value)}
                  className={`h-5 w-5 rounded-full border border-slate-800 transition-transform ${
                    noteColor === c.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  aria-label={c.label}
                />
              ))}

              <button
                type="button"
                onClick={() => setNoteUrgent((v) => !v)}
                className={`px-2 py-[2px] rounded-full text-[10px] border transition ${
                  noteUrgent
                    ? 'border-red-500 bg-red-500/15 text-red-300'
                    : 'border-slate-600 text-slate-300'
                }`}
              >
                {noteUrgent ? 'Επείγον ✔' : 'Επείγον'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddNote}
              disabled={notesSaving || !noteText.trim()}
              className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed text-[11px] py-1"
            >
              {notesSaving ? 'Αποθήκευση…' : 'Προσθήκη σημείωσης'}
            </button>
          </div>
        </div>

        {/* notes list */}
        <div className="border-t border-slate-700 pt-2">
          {notesLoading ? (
            <p className="text-[11px] text-slate-300">
              Φόρτωση σημειώσεων…
            </p>
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
                {pageNotes.map((note, idx) => {
                  const globalIndex =
                    (notesPage - 1) * NOTES_PER_PAGE + idx + 1;

                  return (
                    <li
                      key={note.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1 border border-transparent"
                      style={{
                        background: `linear-gradient(to right, ${note.color}40, transparent)`,
                        borderColor: note.is_urgent
                          ? 'rgba(248, 113, 113, 0.8)'
                          : 'transparent',
                      }}
                    >
                      <div
                        className="mt-[3px] h-3 w-3 rounded-full flex-shrink-0 border border-slate-800"
                        style={{ backgroundColor: note.color }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="whitespace-pre-wrap text-slate-100">
                            {note.content}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-[10px] text-slate-300 hover:text-red-400"
                          >
                            Διαγραφή
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-200">
                            Σημείωση #{globalIndex}
                          </span>

                          {note.is_urgent && (
                            <span className="text-[10px] px-2 py-[1px] rounded-full bg-red-500/20 text-red-300 border border-red-500/60">
                              Επείγον
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleUrgent(note.id, note.is_urgent)
                            }
                            className="text-[10px] px-2 py-[1px] rounded-full border border-slate-600 text-slate-200 hover:border-red-400 hover:text-red-300"
                          >
                            {note.is_urgent
                              ? 'Αφαίρεση επείγοντος'
                              : 'Σήμανση επείγον'}
                          </button>

                          {/* per-note color picker – dots */}
                          <div className="flex items-center gap-1">
                            {NOTE_COLORS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() =>
                                  handleChangeNoteColor(note.id, c.value)
                                }
                                className={`h-4 w-4 rounded-full border border-slate-800 transition-transform ${
                                  note.color === c.value
                                    ? 'ring-2 ring-white ring-offset-[1px]'
                                    : ''
                                }`}
                                style={{ backgroundColor: c.value }}
                                title={c.label}
                                aria-label={c.label}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* pagination */}
              {totalNotesPages > 1 && (
                <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-300">
                  <button
                    type="button"
                    onClick={() =>
                      setNotesPage((p) => Math.max(1, p - 1))
                    }
                    disabled={notesPage === 1}
                    className="px-2 py-[2px] rounded border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Προηγούμενη
                  </button>
                  <span>
                    Σελίδα {notesPage} από {totalNotesPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotesPage((p) =>
                        Math.min(totalNotesPages, p + 1),
                      )
                    }
                    disabled={notesPage === totalNotesPages}
                    className="px-2 py-[2px] rounded border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
