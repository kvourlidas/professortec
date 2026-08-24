// src/components/TopBar.tsx
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Sun, Moon, Plus, GraduationCap, UserCog, BookOpen } from 'lucide-react';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { getPageTitle } from '../pageTitles';
import AssistantWidget from './assistant/AssistantWidget.tsx';

type Props = { onOpenMobileMenu: () => void };

export default function TopBar({ onOpenMobileMenu }: Props) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const isFrontistirio = profile?.account_type === 'frontistirio';

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) setQuickAddOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const goCreate = (path: string) => {
    setQuickAddOpen(false);
    navigate(path, { state: { openCreate: true } });
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="sticky top-0 z-20 px-4 pt-4 pb-2">
      <div
        className="mx-auto flex h-20 max-w-6xl items-center gap-4 rounded-full px-5 shadow-lg"
        style={{ background: 'var(--color-navbar-bg)' }}
      >
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Άνοιγμα μενού"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/[0.12] hover:text-white md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Profile */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'rgba(255,255,255,0.18)' }}>
            {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
          </div>
          <p className="hidden min-w-0 truncate text-sm font-semibold leading-tight text-white sm:block">
            {profile?.full_name || user?.email}
          </p>
        </div>

        {/* Page title */}
        <div className="hidden flex-1 justify-center md:flex">
          {pageTitle && (
            <div className="flex items-center gap-2.5 rounded-full px-5 py-2" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Σελίδα</span>
              <span className="h-5 w-px bg-white/25" />
              <p className="truncate text-2xl font-bold tracking-tight text-white">{pageTitle}</p>
            </div>
          )}
        </div>
        <div className="flex-1 md:hidden" />

        {/* Quick add */}
        <div ref={quickAddRef} className="relative">
          <button
            type="button"
            onClick={() => setQuickAddOpen((v) => !v)}
            aria-label="Γρήγορη προσθήκη"
            title="Γρήγορη προσθήκη"
            aria-haspopup="menu"
            aria-expanded={quickAddOpen}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-sm transition ${
              quickAddOpen
                ? 'bg-white text-[color:var(--color-accent-on-white)]'
                : 'bg-white text-[color:var(--color-accent-on-white)] hover:brightness-105 active:scale-[0.97]'
            }`}
          >
            <Plus className={`h-4 w-4 transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''}`} />
            <span className="hidden sm:inline">Νέο</span>
          </button>

          {quickAddOpen && (
            <div
              role="menu"
              className={`absolute right-0 top-[calc(100%+8px)] w-44 overflow-hidden rounded-xl border py-1 shadow-lg ${
                isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
              }`}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => goCreate('/students')}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition ${
                  isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                Νέος μαθητής
              </button>
              {isFrontistirio && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goCreate('/classes')}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition ${
                      isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    Νέο τμήμα
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goCreate('/tutors')}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition ${
                      isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <UserCog className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    Νέος καθηγητής
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div className="flex items-center rounded-full p-1" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Φωτεινό θέμα"
            title="Φωτεινό θέμα"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              !isDark ? 'bg-white text-amber-500 shadow-sm' : 'text-white/70 hover:text-white'
            }`}
          >
            <Sun className="h-4 w-4" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Σκοτεινό θέμα"
            title="Σκοτεινό θέμα"
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              isDark ? 'bg-white/20 text-white shadow-sm' : 'text-white/70 hover:text-white'
            }`}
          >
            <Moon className="h-4 w-4" />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>

        {/* AI assistant */}
        <AssistantWidget />

        {/* Divider */}
        <span className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />

        <button
          type="button"
          onClick={signOut}
          aria-label="Αποσύνδεση"
          title="Αποσύνδεση"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:border-rose-300/70 hover:bg-rose-500/20 hover:text-rose-100 active:scale-[0.96]"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
