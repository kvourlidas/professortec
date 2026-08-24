// src/components/ui/StyledSelect.tsx
// Drop-in replacement for native <select>: same trigger box (pass the same
// className the <select> used), but the option list is a custom panel with
// a soft-purple hover instead of the browser's native popup.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type Props = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  className: string;
  style?: CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  showChevron?: boolean;
};

export default function StyledSelect({
  options, value, onChange, isDark, className, style, placeholder = '', disabled = false, showChevron = false,
}: Props) {
  const selected = options.find((o) => o.value === value) ?? null;
  const selectedLabel = selected?.label ?? '';
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(selectedLabel); }, [selectedLabel]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(selectedLabel); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, selectedLabel]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return options;
    return options.filter((o) => normalizeText(o.label).includes(q));
  }, [options, query]);

  const handleSelect = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.value);
    setQuery(o.label);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery(selectedLabel); } }}
        placeholder={placeholder}
        disabled={disabled}
        style={style}
        className={`${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      />
      {showChevron && (
        <ChevronDown
          className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        />
      )}

      {open && !disabled && (
        <div
          className={`absolute left-0 top-full z-50 mt-1.5 max-h-64 w-full min-w-[10rem] overflow-y-auto rounded-xl border shadow-2xl
            ${isDark ? 'border-white/10 bg-slate-900/95 shadow-black/60' : 'border-slate-200/80 bg-white/95 shadow-slate-300/50'}`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {filtered.length === 0 ? (
            <div className={`px-3 py-2.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν αποτελέσματα</div>
          ) : filtered.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => handleSelect(o)}
                onMouseEnter={() => setHoveredValue(o.value)}
                onMouseLeave={() => setHoveredValue((h) => (h === o.value ? null : h))}
                style={hoveredValue === o.value && !o.disabled ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 16%, transparent)' } : undefined}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium transition-colors duration-100
                  ${o.disabled ? 'cursor-not-allowed opacity-40' : ''}
                  ${active ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}
              >
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
