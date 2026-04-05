import { useRef } from 'react';
import { Search, School, Pencil, Trash2, GraduationCap, BookOpen } from 'lucide-react';
import type { ClassRow, SubjectRow } from './types';

export type StudentRow = { id: string; full_name: string | null };

interface ClassesGridProps {
  loading: boolean;
  classes: ClassRow[];
  filteredClasses: ClassRow[];
  subjects: SubjectRow[];
  levelNameById: Map<string, string>;
  studentsByClass: Record<string, StudentRow[]>;
  isDark: boolean;
  onEditClass: (c: ClassRow) => void;
  onDeleteClass: (target: { id: string; title: string }) => void;
  onViewStudents: (target: { id: string; title: string }) => void;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

const AVATAR_COLOR_LIGHT = { bg: 'bg-blue-100', text: 'text-blue-700' };
const AVATAR_COLOR_DARK = { bg: 'bg-amber-900/50', text: 'text-amber-300' };

function avatarColor(dark: boolean) {
  return dark ? AVATAR_COLOR_DARK : AVATAR_COLOR_LIGHT;
}

export default function ClassesGrid({
  loading,
  classes,
  filteredClasses,
  subjects,
  levelNameById,
  studentsByClass,
  isDark,
  onEditClass,
  onDeleteClass,
  onViewStudents,
}: ClassesGridProps) {

  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollBy({ left: e.deltaY * 1.5, behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    const bar = barRef.current;
    if (!el || !bar) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    bar.style.width = `${((el.scrollLeft / max) * 100).toFixed(1)}%`;
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="flex gap-4 p-5 overflow-x-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`animate-pulse rounded-2xl border h-64 shrink-0 w-72 ${isDark ? 'border-slate-700/50 bg-slate-800/40' : 'border-slate-200 bg-slate-100'}`} />
        ))}
      </div>
    );
  }

  /* ── Empty: no classes at all ── */
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <School className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη τμήματα</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη Τμήματος» για να δημιουργήσετε το πρώτο.</p>
        </div>
      </div>
    );
  }

  /* ── Empty: no search results ── */
  if (filteredClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν τμήματα</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
        </div>
      </div>
    );
  }

  /* ── Grid ── */
  return (
    <div className="flex flex-col">

      {/* Scrollable cards row — native scrollbar hidden */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className="flex gap-4 p-5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {filteredClasses.map((cls) => {
          const subj = cls.subject_id ? subjects.find((s) => s.id === cls.subject_id) : null;
          const levelName = subj?.level_id ? levelNameById.get(subj.level_id) ?? null : null;
          const subjectNames = cls.subject ? cls.subject.split(',').map((s) => s.trim()).filter(Boolean) : [];
          const students = studentsByClass[cls.id] ?? [];

          return (
            <div
              key={cls.id}
              className={`flex flex-col rounded-2xl border overflow-hidden transition-shadow hover:shadow-md shrink-0 w-72 ${
                isDark
                  ? 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600/70'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* ── Card header ── */}
              <div className={`flex items-start justify-between gap-2 px-4 py-3.5 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'}`}>
                <div className="flex items-center min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                    {cls.title}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditClass(cls)}
                    title="Επεξεργασία"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition hover:scale-105 active:scale-95 ${
                      isDark
                        ? 'border-slate-700/60 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700/50'
                        : 'border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteClass({ id: cls.id, title: cls.title })}
                    title="Διαγραφή"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition hover:scale-105 active:scale-95 ${
                      isDark
                        ? 'border-slate-700/60 text-red-400 hover:bg-red-900/30 hover:border-red-700/50'
                        : 'border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* ── Level + Subjects ── */}
              <div className={`px-4 py-3 flex flex-col gap-2 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'}`}>
                {levelName ? (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className={`h-3 w-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {levelName}
                    </span>
                  </div>
                ) : (
                  <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Χωρίς επίπεδο</span>
                )}

                {subjectNames.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <BookOpen className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {subjectNames.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Students ── */}
              <div className="flex-1 px-4 py-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Μαθητές {students.length > 0 && `(${students.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onViewStudents({ id: cls.id, title: cls.title })}
                    className={`text-[11px] font-semibold rounded-md border px-2 py-0.5 transition-opacity hover:opacity-60 ${
                      isDark
                        ? 'text-amber-400 border-amber-400/40'
                        : 'text-blue-500 border-blue-300'
                    }`}
                  >
                    Διαχείριση →
                  </button>
                </div>

                {students.length === 0 ? (
                  <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Δεν υπάρχουν μαθητές ακόμα
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {students.map((st) => {
                      const color = avatarColor(isDark);
                      return (
                        <li key={st.id} className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${color.bg} ${color.text}`}>
                            {initials(st.full_name)}
                          </div>
                          <span className={`text-xs truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {st.full_name ?? 'Χωρίς όνομα'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom progress bar — replaces native scrollbar */}
      <div className={`mx-5 mb-4 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700/40' : 'bg-slate-200'}`}>
        <div
          ref={barRef}
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: '0%',
            background: isDark
              ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          }}
        />
      </div>

    </div>
  );
}