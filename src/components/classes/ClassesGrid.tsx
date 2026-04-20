import { useRef, useState, useEffect } from 'react';
import { Search, School, Pencil, Trash2, GraduationCap, BookOpen, GripVertical } from 'lucide-react';
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
const AVATAR_COLOR_DARK  = { bg: 'bg-amber-900/50', text: 'text-amber-300' };
function avatarColor(dark: boolean) { return dark ? AVATAR_COLOR_DARK : AVATAR_COLOR_LIGHT; }

/* ── Single card ── */
function ClassCard({
  cls, subjects, levelNameById, studentsByClass, isDark,
  onEditClass, onDeleteClass, onViewStudents,
  isDragging, dropSide,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  cls: ClassRow; subjects: SubjectRow[]; levelNameById: Map<string, string>;
  studentsByClass: Record<string, StudentRow[]>; isDark: boolean;
  onEditClass: (c: ClassRow) => void;
  onDeleteClass: (t: { id: string; title: string }) => void;
  onViewStudents: (t: { id: string; title: string }) => void;
  isDragging: boolean;
  dropSide: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragOver: (side: 'before' | 'after') => void;
  onDrop: (side: 'before' | 'after') => void;
  onDragEnd: () => void;
}) {
  const subj         = cls.subject_id ? subjects.find((s) => s.id === cls.subject_id) : null;
  const levelName    = subj?.level_id ? levelNameById.get(subj.level_id) ?? null : null;
  const subjectNames = cls.subject ? cls.subject.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const students     = studentsByClass[cls.id] ?? [];
  const cardRef      = useRef<HTMLDivElement>(null);

  const getSide = (e: React.DragEvent): 'before' | 'after' => {
    if (!cardRef.current) return 'after';
    const { left, width } = cardRef.current.getBoundingClientRect();
    return e.clientX < left + width / 2 ? 'before' : 'after';
  };

  const accentStyle = { borderColor: 'var(--color-accent)' };

  return (
    <div
      ref={cardRef}
      className="relative shrink-0 w-72"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(getSide(e)); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(getSide(e)); }}
    >
      {/* Left drop indicator */}
      {dropSide === 'before' && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-full z-20"
          style={{ background: 'var(--color-accent)', transform: 'translateX(-6px)' }} />
      )}

      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
        onDragEnd={onDragEnd}
        className={`flex flex-col rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
          isDragging ? 'opacity-40 scale-[0.97]' : ''
        } ${
          isDark ? 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600/70'
                 : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
        style={dropSide === 'before' ? { borderLeft: '2px solid', ...accentStyle } : dropSide === 'after' ? { borderRight: '2px solid', ...accentStyle } : undefined}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-2 px-4 py-3.5 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`shrink-0 cursor-grab active:cursor-grabbing ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-400'}`}>
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{cls.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => onEditClass(cls)} title="Επεξεργασία"
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition hover:scale-105 active:scale-95 ${
                isDark ? 'border-slate-700/60 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700/50'
                       : 'border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200'}`}>
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => onDeleteClass({ id: cls.id, title: cls.title })} title="Διαγραφή"
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition hover:scale-105 active:scale-95 ${
                isDark ? 'border-slate-700/60 text-red-400 hover:bg-red-900/30 hover:border-red-700/50'
                       : 'border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200'}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Level + Subjects */}
        <div className={`px-4 py-3 flex flex-col gap-2 ${isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'}`}>
          {levelName ? (
            <div className="flex items-center gap-1.5">
              <GraduationCap className={`h-3 w-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{levelName}</span>
            </div>
          ) : (
            <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Χωρίς επίπεδο</span>
          )}
          {subjectNames.length > 0 && (
            <div className="flex items-start gap-1.5">
              <BookOpen className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{subjectNames.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Students */}
        <div className="flex-1 px-4 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Μαθητές {students.length > 0 && `(${students.length})`}
            </span>
            <button type="button" onClick={() => onViewStudents({ id: cls.id, title: cls.title })}
              className={`text-[11px] font-semibold rounded-md border px-2 py-0.5 transition-opacity hover:opacity-60 ${
                isDark ? 'text-amber-400 border-amber-400/40' : 'text-blue-500 border-blue-300'}`}>
              Διαχείριση →
            </button>
          </div>
          {students.length === 0 ? (
            <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν υπάρχουν μαθητές ακόμα</p>
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

      {/* Right drop indicator */}
      {dropSide === 'after' && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-0.5 rounded-full z-20"
          style={{ background: 'var(--color-accent)', transform: 'translateX(6px)' }} />
      )}
    </div>
  );
}

/* ── Horizontal scrollable row per level ── */
function LevelSection({
  levelId, levelName, orderedClassIds, classesById,
  subjects, levelNameById, studentsByClass, isDark,
  onEditClass, onDeleteClass, onViewStudents, isLast,
  isDraggingLevel, dropPosition,
  onLevelDragStart, onLevelDragOver, onLevelDrop, onLevelDragEnd,
  draggingCardId, dragOverCardId, dragOverCardSide,
  onCardDragStart, onCardDragOver, onCardDrop, onCardDragEnd,
}: {
  levelId: string | null; levelName: string;
  orderedClassIds: string[]; classesById: Map<string, ClassRow>;
  subjects: SubjectRow[]; levelNameById: Map<string, string>;
  studentsByClass: Record<string, StudentRow[]>; isDark: boolean;
  onEditClass: (c: ClassRow) => void;
  onDeleteClass: (t: { id: string; title: string }) => void;
  onViewStudents: (t: { id: string; title: string }) => void;
  isLast: boolean;
  isDraggingLevel: boolean;
  dropPosition: 'before' | 'after' | null;
  onLevelDragStart: () => void;
  onLevelDragOver: (pos: 'before' | 'after') => void;
  onLevelDrop: (pos: 'before' | 'after') => void;
  onLevelDragEnd: () => void;
  draggingCardId: string | null;
  dragOverCardId: string | null;
  dragOverCardSide: 'before' | 'after' | null;
  onCardDragStart: (classId: string) => void;
  onCardDragOver: (classId: string, side: 'before' | 'after') => void;
  onCardDrop: (classId: string, side: 'before' | 'after') => void;
  onCardDragEnd: () => void;
}) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const barRef     = useRef<HTMLDivElement>(null);
  const headerRef  = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollBy({ left: e.deltaY * 1.5, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current, bar = barRef.current;
    if (!el || !bar) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) { bar.style.width = '100%'; return; }
    bar.style.width = `${((el.scrollLeft / max) * 100).toFixed(1)}%`;
  };

  const canOverflow = orderedClassIds.length > 3;

  const getDropPos = (e: React.DragEvent): 'before' | 'after' => {
    if (!headerRef.current) return 'after';
    const { top, height } = headerRef.current.getBoundingClientRect();
    return e.clientY < top + height / 2 ? 'before' : 'after';
  };

  return (
    <div
      className={`flex flex-col transition-opacity ${isDraggingLevel ? 'opacity-40' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onLevelDragOver(getDropPos(e)); }}
      onDrop={(e) => { e.preventDefault(); onLevelDrop(getDropPos(e)); }}
    >
      {/* Top drop indicator */}
      {dropPosition === 'before' && (
        <div className="mx-1 mb-1 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
      )}

      {/* Level heading */}
      <div ref={headerRef} className="flex items-center gap-2 px-1 pt-3 pb-2">
        {/* Drag handle for level */}
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onLevelDragStart(); }}
          onDragEnd={onLevelDragEnd}
          className={`cursor-grab active:cursor-grabbing rounded p-0.5 transition ${isDark ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
          title="Σύρετε για αλλαγή σειράς"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
          style={{ background: levelId
            ? 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))'
            : isDark ? '#334155' : '#e2e8f0' }}>
          <GraduationCap className="h-3.5 w-3.5"
            style={{ color: levelId ? 'var(--color-input-bg)' : isDark ? '#94a3b8' : '#64748b' }} />
        </div>
        <span className={`text-sm font-semibold tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {levelName}
        </span>
        <span className={`text-[11px] rounded-full px-2 py-0.5 border ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
          {orderedClassIds.length} {orderedClassIds.length === 1 ? 'τμήμα' : 'τμήματα'}
        </span>
      </div>

      {/* Cards row */}
      <div ref={scrollRef} onWheel={handleWheel} onScroll={handleScroll}
        className="flex gap-4 px-1 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
        {orderedClassIds.map((classId) => {
          const cls = classesById.get(classId);
          if (!cls) return null;
          return (
            <ClassCard
              key={classId}
              cls={cls}
              subjects={subjects}
              levelNameById={levelNameById}
              studentsByClass={studentsByClass}
              isDark={isDark}
              onEditClass={onEditClass}
              onDeleteClass={onDeleteClass}
              onViewStudents={onViewStudents}
              isDragging={draggingCardId === classId}
              dropSide={dragOverCardId === classId ? dragOverCardSide : null}
              onDragStart={() => onCardDragStart(classId)}
              onDragOver={(side) => onCardDragOver(classId, side)}
              onDrop={(side) => onCardDrop(classId, side)}
              onDragEnd={onCardDragEnd}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      {canOverflow && (
        <div className={`mx-1 mb-2 h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700/40' : 'bg-slate-200'}`}>
          <div ref={barRef} className="h-full rounded-full transition-all duration-75"
            style={{ width: '0%', background: isDark
              ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
        </div>
      )}

      {/* Bottom drop indicator */}
      {dropPosition === 'after' && (
        <div className="mx-1 mt-1 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
      )}

      {/* Divider */}
      {!isLast && dropPosition !== 'after' && (
        <div className={`mt-2 border-t ${isDark ? 'border-slate-700/40' : 'border-slate-100'}`} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Main export
══════════════════════════════════════════ */
export default function ClassesGrid({
  loading, classes, filteredClasses, subjects, levelNameById,
  studentsByClass, isDark, onEditClass, onDeleteClass, onViewStudents,
}: ClassesGridProps) {

  /* ── Ordered state ── */
  const [levelOrder, setLevelOrder]               = useState<string[]>([]);
  const [classOrderByLevel, setClassOrderByLevel] = useState<Map<string, string[]>>(new Map());

  /* ── Drag state ── */
  const [draggingLevelKey, setDraggingLevelKey]   = useState<string | null>(null);
  const [dragOverLevelKey, setDragOverLevelKey]   = useState<string | null>(null);
  const [dragOverLevelPos, setDragOverLevelPos]   = useState<'before' | 'after' | null>(null);
  const [draggingCardId, setDraggingCardId]       = useState<string | null>(null);
  const [draggingCardLevel, setDraggingCardLevel] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId]       = useState<string | null>(null);
  const [dragOverCardSide, setDragOverCardSide]   = useState<'before' | 'after' | null>(null);

  /* ── Recompute groups when filteredClasses changes ── */
  useEffect(() => {
    const naturalOrder: string[] = [];
    const natural = new Map<string, ClassRow[]>();

    filteredClasses.forEach((cls) => {
      const subj    = cls.subject_id ? subjects.find((s) => s.id === cls.subject_id) : null;
      const levelId = subj?.level_id ?? null;
      const key     = levelId ?? '__none__';
      if (!natural.has(key)) { naturalOrder.push(key); natural.set(key, []); }
      natural.get(key)!.push(cls);
    });

    // __none__ always last
    const noneIdx = naturalOrder.indexOf('__none__');
    if (noneIdx > 0) { naturalOrder.splice(noneIdx, 1); naturalOrder.push('__none__'); }

    // Preserve user-defined level order, add new keys at end, remove gone keys
    setLevelOrder((prev) => {
      const kept    = prev.filter((k) => naturalOrder.includes(k));
      const newKeys = naturalOrder.filter((k) => !kept.includes(k));
      return [...kept, ...newKeys];
    });

    // Preserve user-defined class order within each level
    setClassOrderByLevel((prev) => {
      const next = new Map<string, string[]>();
      naturalOrder.forEach((key) => {
        const newIds  = (natural.get(key) ?? []).map((c) => c.id);
        const prevIds = prev.get(key) ?? [];
        const kept    = prevIds.filter((id) => newIds.includes(id));
        const added   = newIds.filter((id) => !kept.includes(id));
        next.set(key, [...kept, ...added]);
      });
      return next;
    });
  }, [filteredClasses, subjects]);

  /* ── Helpers ── */
  const classesById = new Map<string, ClassRow>();
  filteredClasses.forEach((c) => classesById.set(c.id, c));

  /* ── Level drag handlers ── */
  const handleLevelDragStart = (key: string) => { setDraggingLevelKey(key); };

  const handleLevelDragOver = (key: string, pos: 'before' | 'after') => {
    if (key === draggingLevelKey) return;
    setDragOverLevelKey(key);
    setDragOverLevelPos(pos);
  };

  const handleLevelDrop = (targetKey: string, pos: 'before' | 'after') => {
    if (!draggingLevelKey || draggingLevelKey === targetKey) {
      clearLevelDrag(); return;
    }
    setLevelOrder((prev) => {
      const next = prev.filter((k) => k !== draggingLevelKey);
      const idx  = next.indexOf(targetKey);
      next.splice(pos === 'before' ? idx : idx + 1, 0, draggingLevelKey);
      return next;
    });
    clearLevelDrag();
  };

  const clearLevelDrag = () => {
    setDraggingLevelKey(null);
    setDragOverLevelKey(null);
    setDragOverLevelPos(null);
  };

  /* ── Card drag handlers ── */
  const handleCardDragStart = (classId: string, levelKey: string) => {
    setDraggingCardId(classId);
    setDraggingCardLevel(levelKey);
  };

  const handleCardDragOver = (classId: string, side: 'before' | 'after', levelKey: string) => {
    // Ignore hover if dragging from a different level
    if (classId === draggingCardId || draggingCardLevel !== levelKey) return;
    setDragOverCardId(classId);
    setDragOverCardSide(side);
  };

  const handleCardDrop = (targetId: string, side: 'before' | 'after', levelKey: string) => {
    // Only allow reordering within the same level
    if (!draggingCardId || draggingCardId === targetId || draggingCardLevel !== levelKey) {
      clearCardDrag(); return;
    }
    setClassOrderByLevel((prev) => {
      const next = new Map(prev);
      const list = [...(next.get(levelKey) ?? [])].filter((id) => id !== draggingCardId);
      const tgtIdx = list.indexOf(targetId);
      list.splice(side === 'before' ? tgtIdx : tgtIdx + 1, 0, draggingCardId);
      next.set(levelKey, list);
      return next;
    });
    clearCardDrag();
  };

  const clearCardDrag = () => {
    setDraggingCardId(null);
    setDraggingCardLevel(null);
    setDragOverCardId(null);
    setDragOverCardSide(null);
  };

  /* ── Render states ── */
  if (loading) {
    return (
      <div className="flex gap-4 p-1 overflow-x-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`animate-pulse rounded-2xl border h-64 shrink-0 w-72 ${
            isDark ? 'border-slate-700/50 bg-slate-800/40' : 'border-slate-200 bg-slate-100'}`} />
        ))}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <School className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη τμήματα</p>
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη Τμήματος» για να δημιουργήσετε το πρώτο.</p>
      </div>
    );
  }

  if (filteredClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν τμήματα</p>
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {levelOrder.map((key, idx) => {
        const isNone    = key === '__none__';
        const lvlName   = isNone ? 'Χωρίς επίπεδο' : (levelNameById.get(key) ?? 'Άγνωστο επίπεδο');
        const classIds  = classOrderByLevel.get(key) ?? [];

        return (
          <LevelSection
            key={key}
            levelId={isNone ? null : key}
            levelName={lvlName}
            orderedClassIds={classIds}
            classesById={classesById}
            subjects={subjects}
            levelNameById={levelNameById}
            studentsByClass={studentsByClass}
            isDark={isDark}
            onEditClass={onEditClass}
            onDeleteClass={onDeleteClass}
            onViewStudents={onViewStudents}
            isLast={idx === levelOrder.length - 1}
            isDraggingLevel={draggingLevelKey === key}
            dropPosition={dragOverLevelKey === key ? dragOverLevelPos : null}
            onLevelDragStart={() => handleLevelDragStart(key)}
            onLevelDragOver={(pos) => handleLevelDragOver(key, pos)}
            onLevelDrop={(pos) => handleLevelDrop(key, pos)}
            onLevelDragEnd={clearLevelDrag}
            draggingCardId={draggingCardId}
            dragOverCardId={dragOverCardId}
            dragOverCardSide={dragOverCardSide}
            onCardDragStart={(classId) => handleCardDragStart(classId, key)}
            onCardDragOver={(classId, side) => handleCardDragOver(classId, side, key)}
            onCardDrop={(classId, side) => handleCardDrop(classId, side, key)}
            onCardDragEnd={clearCardDrag}
          />
        );
      })}
    </div>
  );
}
