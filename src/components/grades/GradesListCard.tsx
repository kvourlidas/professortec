import { Search, ChevronRight } from 'lucide-react';

interface GradesListCardProps<T extends { id: string; full_name: string }> {
  title: string;
  icon: React.ReactNode;
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
  items: T[];
  onSelect: (item: T) => void;
  selectedId?: string | null;
  isDark: boolean;
}

export default function GradesListCard<T extends { id: string; full_name: string }>({ title, icon, search, onSearch, loading, items, onSelect, selectedId, isDark }: GradesListCardProps<T>) {
  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const cardHeaderCls = isDark
    ? 'flex items-center gap-2.5 border-b border-slate-800/70 bg-slate-900/30 px-4 py-3'
    : 'flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3';

  const listBorderCls = isDark ? 'rounded-lg border border-slate-800/60' : 'rounded-lg border border-slate-200';
  const listDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';

  const listSearchCls = isDark
    ? 'h-8 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const countBadgeCls = isDark
    ? 'ml-auto inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400'
    : 'ml-auto inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500';

  return (
    <div className={cardCls}>
      <div className={cardHeaderCls}>
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</span>
        <span className={countBadgeCls}>{items.length}</span>
      </div>
      <div className="p-3">
        <div className="relative mb-2">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            className={listSearchCls}
            placeholder={`Αναζήτηση ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className={`max-h-[220px] overflow-y-auto grades-scroll ${listBorderCls}`}>
          {loading ? (
            <div className={listDivideCls}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                  <div className={`h-2.5 w-2/3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className={`flex items-center justify-center py-6 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Δεν βρέθηκαν αποτελέσματα.
            </div>
          ) : (
            <div className={listDivideCls}>
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <button key={item.id} type="button" onClick={() => onSelect(item)}
                    className={`group flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? isDark ? 'bg-white/[0.07]' : 'bg-slate-100'
                        : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}>
                    <span className={`text-xs font-medium transition-colors ${
                      isSelected
                        ? isDark ? 'text-slate-50' : 'text-slate-900'
                        : isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-800'
                    }`}>{item.full_name}</span>
                    <ChevronRight className={`h-3.5 w-3.5 transition-colors ${
                      isSelected
                        ? 'text-[color:var(--color-accent)]'
                        : isDark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-300 group-hover:text-slate-500'
                    }`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
