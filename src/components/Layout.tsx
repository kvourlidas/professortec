// src/components/Layout.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { navItems, type NavItem } from '../_nav';
import { Menu, LogOut, ChevronRight, School, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type NavLinkItem = NavItem & {
  to: string;
  label: string;
  icon?: any;
};

type NavGroupItem = NavItem & {
  label: string;
  icon?: any;
  children: NavLinkItem[];
};

type LayoutProps = {
  children: ReactNode;
};

const APP_NAME = 'Tutor Admin';

export default function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>('Μαθήματα');
  const location = useLocation();

  const isDark = theme === 'dark';

  useEffect(() => {
    const loadSchoolName = async () => {
      if (!profile?.school_id) return;
      const { data, error } = await supabase
        .from('schools').select('name').eq('id', profile.school_id).maybeSingle();
      if (!error && data?.name) setSchoolName(data.name);
    };
    loadSchoolName();
  }, [profile?.school_id]);

  useEffect(() => {
    const path = location.pathname;
    const match = navItems.find(
      (it) => it.children?.some((ch) => ch.to && (path === ch.to || path.startsWith(ch.to + '/')))
    );
    if (match?.label) setOpenGroup(match.label);
  }, [location.pathname]);

  const renderLink = (item: NavLinkItem) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.to;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={() =>
          [
            'group flex items-center rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
            isActive
              ? isDark
                ? 'bg-white/[0.08] text-slate-50 shadow-sm shadow-black/20'
                : 'bg-slate-100 text-slate-900 shadow-sm'
              : isDark
              ? 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
          ].join(' ')
        }
      >
        {Icon && (
          <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2.5'}`}>
            <Icon
              className={`h-4 w-4 transition-colors ${
                isActive
                  ? 'text-[color:var(--color-accent)]'
                  : isDark
                  ? 'text-slate-500 group-hover:text-slate-300'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
          </span>
        )}
        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
        {isActive && !sidebarCollapsed && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
        )}
      </NavLink>
    );
  };

  const renderGroup = (item: NavGroupItem) => {
    const Icon = item.icon;
    const isOpen = openGroup === item.label;
    const hasActiveChild = item.children?.some(
      (ch) => location.pathname === ch.to || location.pathname.startsWith(ch.to + '/')
    );

    return (
      <div key={item.label}>
        <button
          type="button"
          onClick={() => setOpenGroup(isOpen ? null : item.label)}
          className={[
            'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-all duration-150',
            hasActiveChild
              ? isDark ? 'text-slate-200' : 'text-slate-800'
              : isDark
              ? 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
          ].join(' ')}
        >
          <span className="flex items-center">
            {Icon && (
              <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2.5'}`}>
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    hasActiveChild
                      ? 'text-[color:var(--color-accent)]'
                      : isDark
                      ? 'text-slate-500 group-hover:text-slate-400'
                      : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
              </span>
            )}
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
          </span>

          {!sidebarCollapsed && (
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${
                isDark ? 'text-slate-600' : 'text-slate-400'
              }`}
            />
          )}
        </button>

        {isOpen && !sidebarCollapsed && (
          <div className="mt-0.5 pl-6">
            <div className="relative">
              <div className={`absolute left-0 top-1 bottom-1 w-px rounded-full ${isDark ? 'bg-slate-700/80' : 'bg-slate-200'}`} />
              <div className="space-y-0.5 pl-3">
                {item.children.map((child: NavLinkItem) => {
                  const ChildIcon = child.icon;
                  const isChildActive = location.pathname === child.to;

                  return (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={() =>
                        [
                          'group flex items-center rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150',
                          isChildActive
                            ? isDark
                              ? 'bg-white/[0.08] text-slate-50 shadow-sm shadow-black/20'
                              : 'bg-slate-100 text-slate-900'
                            : isDark
                            ? 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                        ].join(' ')
                      }
                    >
                      {ChildIcon && (
                        <span className="mr-2 flex items-center justify-center">
                          <ChildIcon
                            className={`h-3.5 w-3.5 transition-colors ${
                              isChildActive
                                ? 'text-[color:var(--color-accent)]'
                                : isDark
                                ? 'text-slate-600 group-hover:text-slate-400'
                                : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          />
                        </span>
                      )}
                      <span className="truncate">{child.label}</span>
                      {isChildActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        className={`hidden md:flex h-full flex-shrink-0 flex-col border-r transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
        style={{
          background: 'var(--color-sidebar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Top — branding + toggle */}
        <div
          className="flex items-start justify-between border-b px-3 py-3.5"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          {!sidebarCollapsed && (
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black mt-0.5"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <School className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-[15px] font-bold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {schoolName || APP_NAME}
                </p>
                <p className={`truncate text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {schoolName ? APP_NAME : ''}
                </p>
              </div>
            </div>
          )}

          {sidebarCollapsed && (
            <div className="mx-auto flex flex-col items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-black"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <School className="h-4 w-4" />
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                  isDark
                    ? 'border-slate-700/70 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:bg-slate-700/60 hover:text-slate-200'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
              isDark
                ? 'border-slate-700/70 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:bg-slate-700/60 hover:text-slate-200'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
            } ${sidebarCollapsed ? 'hidden' : ''}`}
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {navItems.map((item: NavItem) =>
            item.children?.length
              ? renderGroup(item as NavGroupItem)
              : renderLink(item as NavLinkItem)
          )}
        </nav>

        {/* User card — bottom of sidebar */}
        {!sidebarCollapsed && (
          <div
            className="border-t px-3 py-3"
            style={{ borderColor: 'var(--color-border-soft)' }}
          >
            <div className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
              isDark ? 'border-slate-700/60 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
            }`}>
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[12px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {profile?.full_name || user?.email}
                </p>
                <p className={`truncate text-[10px] capitalize ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {profile?.role || 'no role'}
                </p>
              </div>
              <button
                onClick={signOut}
                aria-label="Αποσύνδεση"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Collapsed: avatar + logout stacked */}
        {sidebarCollapsed && (
          <div className="border-t px-2 py-3 flex flex-col items-center gap-2" style={{ borderColor: 'var(--color-border-soft)' }}>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <button
              onClick={signOut}
              aria-label="Αποσύνδεση"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* ── Main column ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header
          className="flex flex-shrink-0 items-center justify-end border-b px-5 py-3 h-[57px] gap-2"
          style={{
            background: 'var(--color-header-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* ── Theme Toggle Button ── */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              isDark
                ? 'border-slate-700/70 bg-slate-800/60 text-amber-400 hover:border-slate-600 hover:bg-slate-700/60'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        {/* Scroll area */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  );
}