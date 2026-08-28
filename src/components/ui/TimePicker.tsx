// src/components/ui/TimePicker.tsx
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Clock } from 'lucide-react';

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

/** Parses free-typed 24-hour input into "HH:MM", or null if invalid.
 * Accepts "22:00", "9:5", "930" (-> 09:30), "2200" (-> 22:00), "9" (-> 09:00). */
function parseTimeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let h: number;
  let m: number;

  const withColon = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (withColon) {
    h = parseInt(withColon[1], 10);
    m = parseInt(withColon[2], 10);
  } else if (/^\d{3,4}$/.test(trimmed)) {
    const digits = trimmed.padStart(4, '0');
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2), 10);
  } else if (/^\d{1,2}$/.test(trimmed)) {
    h = parseInt(trimmed, 10);
    m = 0;
  } else {
    return null;
  }

  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type Props = {
  /** "HH:MM" in 24-hour format, e.g. "08:30" */
  value: string;
  onChange: (time: string) => void;
  required?: boolean;
};

export default function TimePicker({ value, onChange, required }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  // Keep the visible text in sync with the committed value, unless the user is actively editing it.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setInputValue(value);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll selected option into view when opening
  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    selected?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  const handleOpen = () => {
    if (!open && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  const commitInput = () => {
    const parsed = parseTimeInput(inputValue);
    if (parsed) {
      onChange(parsed);
      setInputValue(parsed);
    } else {
      setInputValue(value);
    }
  };

  const triggerCls = isDark
    ? `h-9 w-full rounded-lg border px-3 text-sm font-medium outline-none transition flex items-center justify-between cursor-text
       border-slate-700/70 bg-slate-900/60 text-slate-100
       hover:border-[color:var(--color-accent)]/50
       ${open ? 'border-[color:var(--color-accent)]/60 ring-1 ring-[color:var(--color-accent)]/20' : ''}`
    : `h-9 w-full rounded-lg border px-3 text-sm font-medium outline-none transition flex items-center justify-between cursor-text
       border-slate-300 bg-white text-slate-800
       hover:border-[color:var(--color-accent)]/50
       ${open ? 'border-[color:var(--color-accent)]/60 ring-1 ring-[color:var(--color-accent)]/20' : ''}`;

  const dropdownCls = isDark
    ? 'fixed z-[200] rounded-xl border border-slate-700/70 bg-slate-900 shadow-2xl overflow-y-auto max-h-52 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'fixed z-[200] rounded-xl border border-slate-200 bg-white shadow-xl overflow-y-auto max-h-52 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={triggerCls} onClick={() => { handleOpen(); inputRef.current?.focus(); }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
            setInputValue(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
          }}
          onFocus={handleOpen}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitInput(); setOpen(false); inputRef.current?.blur(); }
            else if (e.key === 'Escape') { setInputValue(value); setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="--:--"
          className={`w-full bg-transparent outline-none ${isDark ? 'placeholder-slate-500' : 'placeholder-slate-400'}`}
        />
        <Clock className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>

      {/* Hidden input for required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          readOnly
          value={value}
          className="sr-only"
          aria-hidden
        />
      )}

      {open && (
        <div
          ref={listRef}
          className={dropdownCls}
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          {TIME_OPTIONS.map((t) => {
            const isSelected = t === value;
            return (
              <div
                key={t}
                data-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(t); setInputValue(t); setOpen(false); }}
                onMouseEnter={() => setHoveredTime(t)}
                onMouseLeave={() => setHoveredTime((h) => (h === t ? null : h))}
                style={!isSelected && hoveredTime === t ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 16%, transparent)' } : undefined}
                className={`px-4 py-2 text-base font-semibold cursor-pointer transition-colors
                  ${isDark
                    ? isSelected
                      ? 'bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]'
                      : 'text-slate-100'
                    : isSelected
                      ? 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                      : 'text-slate-800'
                  }`}
              >
                {t}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
