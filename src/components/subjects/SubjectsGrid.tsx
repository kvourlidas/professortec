// src/components/subjects/SubjectsGrid.tsx
import { useState } from 'react';
import { Search, Layers, Pencil, Trash2, Users } from 'lucide-react';
import SubjectTutorsModal from './SubjectTutorsModal';
import type { LevelRow, SubjectRow, TutorRow } from './types';

interface SubjectsGridProps {
  loading: boolean;
  levels: LevelRow[];
  subjects: SubjectRow[];
  filteredSubjects: SubjectRow[];
  tutorsBySubject: Map<string, TutorRow[]>;
  allTutors: TutorRow[];
  isDark: boolean;
  onEditSubject: (s: SubjectRow) => void;
  onDeleteSubject: (s: SubjectRow) => void;
  onTutorsChanged: () => void;
}

export default function SubjectsGrid({
  loading,
  levels,
  subjects,
  filteredSubjects,
  tutorsBySubject,
  isDark,
  onEditSubject,
  onDeleteSubject,
  onTutorsChanged,
}: SubjectsGridProps) {
  const [tutorsModal, setTutorsModal] = useState<{ id: string; name: string } | null>(null);

  // group filtered subjects by level_id
  const levelIds = levels.map((l) => l.id);
  const subjectsByLevel = new Map<string, SubjectRow[]>();
  const noLevel: SubjectRow[] = [];

  filteredSubjects.forEach((s) => {
    if (s.level_id && levelIds.includes(s.level_id)) {
      const arr = subjectsByLevel.get(s.level_id) ?? [];
      arr.push(s);
      subjectsByLevel.set(s.level_id, arr);
    } else {
      noLevel.push(s);
    }
  });

  const visibleLevels = levels.filter((l) => (subjectsByLevel.get(l.id) ?? []).length > 0);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`animate-pulse rounded-2xl border h-72 ${isDark ? 'border-slate-700/50 bg-slate-800/40' : 'border-slate-200 bg-slate-100'}`} />
        ))}
      </div>
    );
  }

  // ── No subjects at all ──
  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <Layers className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη μαθήματα</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη μαθήματος» για να δημιουργήσετε το πρώτο.</p>
        </div>
      </div>
    );
  }

  // ── No search results ──
  if (filteredSubjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν μαθήματα</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
        </div>
      </div>
    );
  }

  const cardCls = `flex flex-col rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
    isDark
      ? 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600/70'
      : 'border-slate-200 bg-white hover:border-slate-300'
  }`;

  const cardHeaderCls = `flex items-center justify-between gap-2 px-4 py-3.5 ${
    isDark ? 'border-b border-slate-700/50' : 'border-b border-slate-100'
  }`;

  const subjectRowCls = `flex flex-col px-4 py-2.5 ${
    isDark ? 'border-b border-slate-800/50' : 'border-b border-slate-100'
  } last:border-b-0`;

  const renderSubjectRow = (subj: SubjectRow) => {
    const tutors = tutorsBySubject.get(subj.id) ?? [];
    return (
      <div key={subj.id} className={subjectRowCls}>
        {/* Subject name + actions */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: 'var(--color-accent)' }}
          >
            {subj.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Tutors → opens modal */}
            <button
              type="button"
              title="Καθηγητές"
              onClick={() => setTutorsModal({ id: subj.id, name: subj.name })}
              className={`flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
                isDark
                  ? 'border-slate-700/60 text-slate-400 hover:bg-slate-800/50'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Users className="h-3 w-3" />
            </button>
            {/* Edit */}
            <button
              type="button"
              title="Επεξεργασία"
              onClick={() => onEditSubject(subj)}
              className={`flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
                isDark
                  ? 'border-slate-700/60 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700/50'
                  : 'border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200'
              }`}
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            {/* Delete */}
            <button
              type="button"
              title="Διαγραφή"
              onClick={() => onDeleteSubject(subj)}
              className={`flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
                isDark
                  ? 'border-slate-700/60 text-red-400 hover:bg-red-900/30 hover:border-red-700/50'
                  : 'border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200'
              }`}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {/* Tutors — plain text */}
        {tutors.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {tutors.map((t) => (
              <span
                key={t.id}
                className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                {t.full_name ?? 'Χωρίς όνομα'}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        {/* Level cards */}
        {visibleLevels.map((level) => {
          const levelSubjects = subjectsByLevel.get(level.id) ?? [];
          return (
            <div key={level.id} className={cardCls}>
              <div className={cardHeaderCls}>
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                      color: 'var(--color-accent)',
                      border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
                    }}
                  >
                    <Layers className="h-3 w-3" />
                  </div>
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                    {level.name}
                  </p>
                </div>
                <span className={`shrink-0 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {levelSubjects.length} {levelSubjects.length === 1 ? 'μάθημα' : 'μαθήματα'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {levelSubjects.map(renderSubjectRow)}
              </div>
            </div>
          );
        })}

        {/* "No level" card */}
        {noLevel.length > 0 && (
          <div className={cardCls}>
            <div className={cardHeaderCls}>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Χωρίς επίπεδο
              </p>
              <span className={`shrink-0 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {noLevel.length} {noLevel.length === 1 ? 'μάθημα' : 'μαθήματα'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {noLevel.map(renderSubjectRow)}
            </div>
          </div>
        )}
      </div>

      {/* Tutors modal */}
      <SubjectTutorsModal
        open={!!tutorsModal}
        onClose={() => setTutorsModal(null)}
        subjectId={tutorsModal?.id ?? null}
        subjectName={tutorsModal?.name ?? ''}
        onChanged={() => {
          onTutorsChanged();
          setTutorsModal(null);
        }}
      />
    </>
  );
}