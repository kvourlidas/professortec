// src/components/students/dropdownTriggerCls.ts

/**
 * Shared glassy trigger style for all student-page dropdowns.
 * Returns a className string for the trigger <button>.
 */
export function triggerCls(open: boolean, isDark: boolean): string {
  const base = `
    inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium
    select-none transition-all duration-150 cursor-pointer
    border backdrop-blur-md
  `;

  if (isDark) {
    return base + (open
      ? 'border-white/20 bg-white/10 text-white shadow-inner shadow-white/5 ring-1 ring-white/10'
      : 'border-white/10 bg-white/[0.06] text-slate-300 hover:border-white/20 hover:bg-white/[0.10] hover:text-white'
    );
  } else {
    return base + (open
      ? 'border-slate-300/70 bg-white/70 text-slate-800 shadow-inner ring-1 ring-slate-200/80'
      : 'border-slate-200/80 bg-white/50 text-slate-600 shadow-sm hover:border-slate-300/80 hover:bg-white/80 hover:text-slate-800'
    );
  }
}