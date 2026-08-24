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
  isFiltering: boolean;
  tutorsBySubject: Map<string, TutorRow[]>;
  allTutors: TutorRow[];
  isDark: boolean;
  hideTutors?: boolean;
  onEditSubject: (s: SubjectRow) => void;
  onDeleteSubject: (s: SubjectRow) => void;
  onTutorsChanged: () => void;
  onEditLevel: (id: string) => void;
  onDeleteLevel: (l: LevelRow) => void;
}

export default function SubjectsGrid({
  loading,
  levels,
  subjects,
  filteredSubjects,
  isFiltering,
  tutorsBySubject,
  isDark,
  hideTutors = false,
  onEditSubject,
  onDeleteSubject,
  onTutorsChanged,
  onEditLevel,
  onDeleteLevel,
}: SubjectsGridProps) {
  const [tutorsModal, setTutorsModal] = useState<{ id: string; name: string } | null>(null);

  // group filtered subjects by level_id — same order as before (by level, then no-level)
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

  // Without an active search, show every level (even ones with no subjects yet)
  // so a freshly created level appears right away; while searching, only show
  // levels that actually have a matching subject.
  const visibleLevels = isFiltering
    ? levels.filter((l) => (subjectsByLevel.get(l.id) ?? []).length > 0)
    : levels;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-1 py-3.5 animate-pulse">
            <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
            <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
          </div>
        ))}
      </div>
    );
  }

  // ── Nothing at all (no levels, no subjects) ──
  if (subjects.length === 0 && levels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
          <Layers className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη επίπεδα ή μαθήματα</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη επιπέδου» ή «Προσθήκη μαθήματος» για να ξεκινήσετε.</p>
        </div>
      </div>
    );
  }

  // ── No search results ──
  if (isFiltering && filteredSubjects.length === 0) {
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

  const groupHeaderCls = `flex items-center justify-between pb-2.5`;
  const groupHeaderStyle: React.CSSProperties = { borderBottom: '2px solid var(--color-accent)' };
  const groupTitleCls = `text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`;
  const rowDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const rowHoverCls = isDark ? 'transition-colors hover:bg-[color:var(--color-accent)]/[0.12]' : 'transition-colors hover:bg-[color:var(--color-accent)]/10';
  const editBtnCls = `flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
    isDark
      ? 'border-slate-700/60 text-slate-500 hover:bg-[color:var(--color-accent)]/15 hover:border-[color:var(--color-accent)]/40 hover:text-[color:var(--color-accent-hover)]'
      : 'border-slate-200 text-slate-400 hover:bg-[color:var(--color-accent)]/10 hover:border-[color:var(--color-accent)]/30 hover:text-[color:var(--color-accent)]'
  }`;
  const deleteBtnCls = `flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
    isDark
      ? 'border-slate-700/60 text-slate-500 hover:bg-red-900/30 hover:border-red-700/50 hover:text-red-400'
      : 'border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
  }`;
  const tutorsBtnCls = `flex h-6 w-6 items-center justify-center rounded-md border transition hover:scale-105 active:scale-95 ${
    isDark
      ? 'border-slate-700/60 text-slate-400 hover:bg-slate-800/50'
      : 'border-slate-200 text-slate-500 hover:bg-slate-100'
  }`;

  const renderSubjectRow = (subj: SubjectRow) => {
    const tutors = tutorsBySubject.get(subj.id) ?? [];
    return (
      <div key={subj.id} className={`flex flex-col px-1 py-2.5 ${rowHoverCls}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
            {subj.name}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {!hideTutors && (
              <button type="button" title="Καθηγητές" onClick={() => setTutorsModal({ id: subj.id, name: subj.name })} className={tutorsBtnCls}>
                <Users className="h-3 w-3" />
              </button>
            )}
            <button type="button" title="Επεξεργασία" onClick={() => onEditSubject(subj)} className={editBtnCls}>
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button type="button" title="Διαγραφή" onClick={() => onDeleteSubject(subj)} className={deleteBtnCls}>
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
        {!hideTutors && tutors.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {tutors.map((t) => (
              <span key={t.id} className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.full_name ?? 'Χωρίς όνομα'}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const cellBorderCls = isDark ? 'border-slate-800' : 'border-slate-200';

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        {/* Level groups */}
        {visibleLevels.map((level) => {
          const levelSubjects = subjectsByLevel.get(level.id) ?? [];
          return (
            <div key={level.id} className={`flex flex-col border-b border-r px-5 py-5 ${cellBorderCls}`}>
              <div className={groupHeaderCls} style={groupHeaderStyle}>
                <span className={groupTitleCls}>{level.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {levelSubjects.length} {levelSubjects.length === 1 ? 'μάθημα' : 'μαθήματα'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" title="Επεξεργασία επιπέδου" onClick={() => onEditLevel(level.id)} className={editBtnCls}>
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button type="button" title="Διαγραφή επιπέδου" onClick={() => onDeleteLevel(level)} className={deleteBtnCls}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className={rowDivideCls}>
                {levelSubjects.length > 0 ? (
                  levelSubjects.map(renderSubjectRow)
                ) : (
                  <p className={`py-3 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Δεν υπάρχουν ακόμη μαθήματα σε αυτό το επίπεδο.
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* "No level" group */}
        {noLevel.length > 0 && (
          <div className={`flex flex-col border-b border-r px-5 py-5 ${cellBorderCls}`}>
            <div className={groupHeaderCls} style={groupHeaderStyle}>
              <span className={groupTitleCls}>Χωρίς επίπεδο</span>
              <span className={`shrink-0 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {noLevel.length} {noLevel.length === 1 ? 'μάθημα' : 'μαθήματα'}
              </span>
            </div>
            <div className={rowDivideCls}>
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
