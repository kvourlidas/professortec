import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Check, ChevronDown, Search, X } from 'lucide-react';

type MultiSelectDropdownProps = {
  items: { id: string; label: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
  placeholder: string;
  emptyText: string;
  loading?: boolean;
  isDark: boolean;
};

// ── Portal MultiSelect – escapes overflow:hidden on any ancestor ─────────────
export function MultiSelectDropdown({
  items, selectedIds, onToggle, onClearAll, placeholder, emptyText, loading = false, isDark,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()));
  const selectedItems = items.filter((i) => selectedIds.includes(i.id));

  const triggerCls = [
    'flex min-h-[2.625rem] w-full cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs transition-all duration-150',
    open
      ? isDark
        ? 'border border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/20 bg-slate-900/80'
        : 'border border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/15 bg-white'
      : isDark
      ? 'border border-slate-700/70 bg-slate-900/60 hover:border-slate-600/80'
      : 'border border-slate-200 bg-white hover:border-slate-300',
  ].join(' ');

  // KEY FIX: background color set via inline style (not Tailwind) so it can't be
  // overridden by backdrop-blur compositing. backgroundImage: 'none' blocks any
  // page gradient from bleeding through the transparency in the corners.
  const dropdownInlineStyle: React.CSSProperties = isDark
    ? { backgroundColor: 'rgba(15, 22, 35, 0.55)', backgroundImage: 'none' }
    : { backgroundColor: 'rgba(255, 255, 255, 0.55)', backgroundImage: 'none' };

  const portal = open && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
    >
      <div
        className={[
          'overflow-hidden rounded-2xl',
          'shadow-[0_12px_40px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]',
          isDark
            ? 'border border-slate-700/50 backdrop-blur-2xl ring-1 ring-inset ring-white/[0.07]'
            : 'border border-slate-200/80 backdrop-blur-2xl ring-1 ring-inset ring-black/[0.04]',
        ].join(' ')}
        style={dropdownInlineStyle}
      >
        {/* Corner bleed mask – covers the top-right area where page gradient bleeds through */}
        {isDark && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '45%', height: '38%',
            background: 'radial-gradient(ellipse at top right, rgba(13,19,30,0.92) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 0, borderRadius: '0 1rem 0 0',
          }} />
        )}
        {!isDark && (
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '45%', height: '38%',
            background: 'radial-gradient(ellipse at top right, rgba(248,249,251,0.92) 0%, transparent 70%)',
            pointerEvents: 'none', zIndex: 0, borderRadius: '0 1rem 0 0',
          }} />
        )}
        {/* Search */}
        <div className={`relative z-10 flex items-center gap-2.5 border-b px-4 py-3 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          <Search className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Αναζήτηση…"
            className={`flex-1 bg-transparent text-xs outline-none ${isDark ? 'text-slate-100 placeholder-slate-600' : 'text-slate-700 placeholder-slate-400'}`}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              <X className={`h-3 w-3 transition-colors ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`} />
            </button>
          )}
        </div>

        {/* Items */}
        <div
          className="relative z-10 max-h-52 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(100,116,139,0.35) transparent' : 'rgba(148,163,184,0.35) transparent' }}
        >
          {loading ? (
            <div className={`flex items-center justify-center gap-2 py-8 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />Φόρτωση…
            </div>
          ) : filtered.length === 0 ? (
            <div className={`py-8 text-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{emptyText}</div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filtered.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-all duration-100',
                      selected
                        ? isDark ? 'bg-[color-mix(in_srgb,var(--color-accent)_13%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]'
                        : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md transition-all duration-150"
                      style={selected
                        ? { background: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-accent) 22%, transparent)' }
                        : { border: `1.5px solid ${isDark ? 'rgba(100,116,139,0.6)' : '#cbd5e1'}`, background: 'transparent' }
                      }
                    >
                      {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className={selected
                      ? isDark ? 'font-medium text-slate-100' : 'font-medium text-slate-800'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                    }>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`relative z-10 flex items-center justify-between gap-2 border-t px-4 py-2.5 ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          {selectedIds.length > 0 ? (
            <>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}
              >
                {selectedIds.length} επιλεγμένα
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClearAll(); }}
                className={`text-[10px] font-medium transition-colors hover:underline ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Καθαρισμός όλων
              </button>
            </>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="ml-auto rounded-lg px-3 py-1 text-[10px] font-semibold text-white transition hover:brightness-110"
            style={{ background: 'var(--color-accent)' }}
          >
            Εντάξει
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={triggerRef} className="relative">
      <div className={triggerCls} onClick={() => setOpen((v) => !v)}>
        <div className="flex flex-1 flex-wrap gap-1.5 py-0.5">
          {selectedItems.length === 0 ? (
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>{placeholder}</span>
          ) : selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
                color: 'var(--color-accent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 32%, transparent)',
              }}
            >
              {item.label}
              <X className="h-2.5 w-2.5 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onToggle(item.id); }} />
            </span>
          ))}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
      {portal}
    </div>
  );
}
