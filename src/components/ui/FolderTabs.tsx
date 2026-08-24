// src/components/ui/FolderTabs.tsx
// File-folder style tab bar: rounded-top tabs sitting on a subtle bar, the
// active tab's background matches the page so it visually merges into the
// content below. Reference implementation: src/pages/AttendancePage.tsx
import type { ElementType } from 'react';

export type FolderTabDef<T extends string> = {
  key: T;
  label: string;
  icon?: ElementType;
  count?: number;
};

type Props<T extends string> = {
  tabs: FolderTabDef<T>[];
  active: T;
  onChange: (key: T) => void;
  isDark: boolean;
  className?: string;
  /** Equal-width tabs filling the row (e.g. a full-width card header), instead of auto-width. */
  fill?: boolean;
  /** Background the active tab merges into. Defaults to the page background — override when the
   *  tab bar sits at the top of a self-contained card whose body uses a different background. */
  activeBg?: string;
};

export default function FolderTabs<T extends string>({ tabs, active, onChange, isDark, className, fill = false, activeBg = 'var(--color-background)' }: Props<T>) {
  const barBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgb(226 232 240)';
  const inactiveBg = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.03)';

  return (
    <div
      className={`${fill ? 'grid' : 'inline-flex self-start'} items-end ${className ?? ''}`}
      style={{ borderBottom: `1px solid ${barBorder}`, ...(fill ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` } : {}) }}
    >
      {tabs.map((t, i) => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`relative flex items-center gap-1.5 rounded-t-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
              i > 0 ? '-ml-px' : ''
            } ${isActive ? 'z-10' : isDark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}
            style={{
              borderColor: barBorder,
              borderBottomColor: isActive ? activeBg : barBorder,
              background: isActive ? activeBg : inactiveBg,
              color: isActive ? 'var(--color-accent)' : (isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)'),
              marginBottom: isActive ? -1 : 0,
            }}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
                style={{
                  background: isActive ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'),
                  color: isActive ? 'var(--color-accent)' : undefined,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
