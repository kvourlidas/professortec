import { useState } from 'react';
import { Search, ChevronRight, Users, GraduationCap } from 'lucide-react';

interface GradesListCardProps<S extends { id: string; full_name: string }, T extends { id: string; full_name: string }> {
  studentSearch: string;
  onStudentSearch: (v: string) => void;
  loadingStudents: boolean;
  students: S[];
  onSelectStudent: (item: S) => void;
  selectedStudentId?: string | null;

  tutorSearch: string;
  onTutorSearch: (v: string) => void;
  loadingTutors: boolean;
  tutors: T[];
  onSelectTutor: (item: T) => void;
  selectedTutorId?: string | null;

  isDark: boolean;
}

type Tab = 'students' | 'tutors';

export default function GradesListCard<
  S extends { id: string; full_name: string },
  T extends { id: string; full_name: string }
>({
  studentSearch, onStudentSearch, loadingStudents, students, onSelectStudent, selectedStudentId,
  tutorSearch, onTutorSearch, loadingTutors, tutors, onSelectTutor, selectedTutorId,
  isDark,
}: GradesListCardProps<S, T>) {
  const [tab, setTab] = useState<Tab>('students');

  const isStudents = tab === 'students';
  const search = isStudents ? studentSearch : tutorSearch;
  const onSearch = isStudents ? onStudentSearch : onTutorSearch;
  const loading = isStudents ? loadingStudents : loadingTutors;
  const items = isStudents ? students : tutors;
  const onSelect = isStudents
    ? (onSelectStudent as (item: S | T) => void)
    : (onSelectTutor as (item: S | T) => void);
  const selectedId = isStudents ? selectedStudentId : selectedTutorId;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'students', label: 'Μαθητές',   icon: <Users className="h-4 w-4" />,         count: students.length },
    { key: 'tutors',   label: 'Καθηγητές', icon: <GraduationCap className="h-4 w-4" />, count: tutors.length  },
  ];

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
        : 'border-slate-200 bg-white/80 ring-black/[0.02]'
    }`}>
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      {/* Tab row */}
      <div className={`grid grid-cols-2 border-b ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        {tabs.map(({ key, label, icon, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex items-center justify-center gap-2 px-4 py-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                active
                  ? isDark ? 'text-white bg-slate-900/60' : 'text-slate-900 bg-white'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]' : 'text-slate-400 bg-slate-50 hover:text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              <span style={active ? { color: 'var(--color-accent)' } : undefined}>{icon}</span>
              <span>{label}</span>
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: active ? 'var(--color-accent)' : isDark ? 'rgb(30 41 59 / 0.8)' : 'rgb(226 232 240)' }}
              />
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className={`px-3 pt-3 pb-2 ${isDark ? 'bg-slate-950/20' : 'bg-white'}`}>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            className={`h-9 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none transition ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
                : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
            }`}
            placeholder={`Αναζήτηση ${isStudents ? 'μαθητών' : 'καθηγητών'}...`}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto grades-scroll relative">
        {loading ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                <div
                  className={`h-3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
                  style={{ width: `${50 + (i * 13) % 35}%` }}
                />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={`flex items-center justify-center py-10 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δεν βρέθηκαν αποτελέσματα.
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-slate-800/40' : 'divide-slate-100'}`}>
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`group relative flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-100 ${
                    isSelected
                      ? isDark ? 'bg-white/[0.06]' : 'bg-slate-100'
                      : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                  <span className={`truncate text-[13px] font-medium transition-colors ${
                    isSelected
                      ? isDark ? 'text-white' : 'text-slate-900'
                      : isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-800'
                  }`}>
                    {item.full_name}
                  </span>
                  <ChevronRight
                    className={`ml-2 h-4 w-4 shrink-0 transition-colors ${
                      isSelected
                        ? ''
                        : isDark ? 'text-slate-700 group-hover:text-slate-500' : 'text-slate-300 group-hover:text-slate-400'
                    }`}
                    style={isSelected ? { color: 'var(--color-accent)' } : undefined}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`border-t px-4 py-2 ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
        <span className={`text-[11px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {items.length} {isStudents ? 'μαθητές' : 'καθηγητές'} σύνολο
        </span>
      </div>
    </div>
  );
}