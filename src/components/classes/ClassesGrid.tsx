import { useRef } from 'react';
import { Search, School, Pencil, Trash2, UserPlus, GraduationCap, BookOpen } from 'lucide-react';
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

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
];

const AVATAR_COLORS_DARK = [
  { bg: 'bg-blue-900/50', text: 'text-blue-300' },
  { bg: 'bg-violet-900/50', text: 'text-violet-300' },
  { bg: 'bg-emerald-900/50', text: 'text-emerald-300' },
  { bg: 'bg-amber-900/50', text: 'text-amber-300' },
  { bg: 'bg-rose-900/50', text: 'text-rose-300' },
];

function avatarColor(id: string, dark: boolean) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return dark ? AVATAR_COLORS_DARK[idx] : AVATAR_COLORS[idx];
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                      color: 'var(--color-accent)',
                      border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
                    }}
                  >
                    {cls.title.slice(0, 2).toUpperCase()}
                  </div>
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
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      isDark
                        ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {levelName}
                    </span>
                  </div>
                ) : (
                  <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Χωρίς επίπεδο</span>
                )}

                {subjectNames.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <BookOpen className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <div className="flex flex-wrap gap-1">
                      {subjectNames.map((name) => (
                        <span
                          key={name}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
                            isDark
                              ? 'border-slate-700/50 bg-slate-800/60 text-slate-300'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
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
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition active:scale-95 ${
                      isDark
                        ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-800/40'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <UserPlus className="h-3 w-3" />
                    Διαχείριση
                  </button>
                </div>

                {students.length === 0 ? (
                  <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Δεν υπάρχουν μαθητές ακόμα
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {students.map((st) => {
                      const color = avatarColor(st.id, isDark);
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