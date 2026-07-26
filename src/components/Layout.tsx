// src/components/Layout.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { navItems, idiaiterouNavItems, type NavItem } from '../_nav';
import { Menu, LogOut, ChevronRight, Building2, User } from 'lucide-react';
import logoLight from '../assets/edra-primary-transparent-light(PNG)(1).png';
import logoDark from '../assets/edra-primary-transparent-dark(PNG).png';
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


export default function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [_schoolName, setSchoolName] = useState<string | null>(null);
  const sidebarCollapsed = false;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>('Μαθήματα');
  const location = useLocation();

  const isDark = theme === 'dark';
  const isIdiaiterou = profile?.account_type === 'idiaiterou';
  const activeNav = isIdiaiterou ? idiaiterouNavItems : navItems;

  // Sidebar background is the blue accent color in both themes, so it always needs
  // white-based text/overlays regardless of light/dark mode.
  const sbText         = 'text-white';
  const sbTextMuted    = 'text-white/75';
  const sbTextFaint    = 'text-white/60';
  const sbActiveBg     = 'bg-white/15';
  const sbActiveText   = 'text-white';
  const sbHoverBg      = 'hover:bg-white/[0.10]';
  const sbHoverText    = 'hover:text-white';
  const sbIconInactive = 'text-white/70';
  const sbIconActive   = 'text-white';
  const sbIconHover    = 'group-hover:text-white';
  const sbBorderColor  = 'rgba(255,255,255,0.18)';
  const sbDotColor     = '#ffffff';

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
    const match = activeNav.find(
      (it) => it.children?.some((ch) => ch.to && (path === ch.to || path.startsWith(ch.to + '/')))
    );
    if (match?.label) setOpenGroup(match.label);
    setMobileOpen(false);
  }, [location.pathname, activeNav]);

  const renderLink = (item: NavLinkItem) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.to;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={() =>
          [
            'group flex items-center rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
            isActive
              ? `${sbActiveBg} ${sbActiveText} shadow-sm shadow-black/10`
              : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
          ].join(' ')
        }
      >
        {Icon && (
          <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2'}`}>
            <Icon
              className={`h-3.5 w-3.5 transition-colors ${
                isActive ? sbIconActive : `${sbIconInactive} ${sbIconHover}`
              }`}
            />
          </span>
        )}
        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
        {isActive && !sidebarCollapsed && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sbDotColor }} />
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
            'group flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-[12px] font-medium transition-all duration-150',
            hasActiveChild
              ? sbActiveText
              : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
          ].join(' ')}
        >
          <span className="flex items-center">
            {Icon && (
              <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2'}`}>
                <Icon
                  className={`h-3.5 w-3.5 transition-colors ${
                    hasActiveChild
                      ? sbIconActive
                      : `${sbIconInactive} ${sbIconHover}`
                  }`}
                />
              </span>
            )}
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
          </span>

          {!sidebarCollapsed && (
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${sbTextFaint}`}
            />
          )}
        </button>

        {isOpen && !sidebarCollapsed && (
          <div className="mt-0.5 pl-6">
            <div className="relative">
              <div className="absolute left-0 top-1 bottom-1 w-px rounded-full bg-white/20" />
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
                          'group flex items-center rounded-lg px-2.5 py-1 text-[12px] font-medium transition-all duration-150',
                          isChildActive
                            ? `${sbActiveBg} ${sbActiveText} shadow-sm`
                            : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
                        ].join(' ')
                      }
                    >
                      {ChildIcon && (
                        <span className="mr-2 flex items-center justify-center">
                          <ChildIcon
                            className={`h-3.5 w-3.5 transition-colors ${
                              isChildActive
                                ? sbIconActive
                                : `${sbIconInactive} ${sbIconHover}`
                            }`}
                          />
                        </span>
                      )}
                      <span className="truncate">{child.label}</span>
                      {isChildActive && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sbDotColor }} />
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

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-shrink-0 flex-col border-r transition-all duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
          ${sidebarCollapsed ? 'w-16' : 'w-60'}
        `}
        style={{
          background: 'var(--color-sidebar-bg)',
          borderColor: sbBorderColor,
        }}
      >
        {/* Top — branding + toggle */}
        <div
          className="flex flex-col gap-2.5 border-b px-3 pt-3 pb-3"
          style={{ borderColor: sbBorderColor }}
        >
          {/* Row 1: logo */}
          <div style={{ height: '48px', overflow: 'hidden' }}>
            <img
              src={logoDark}
              alt="edra"
              style={{ height: '200px', width: 'auto', marginTop: '-78px' }}
            />
          </div>

          {/* Row 2: theme toggle */}
          {!sidebarCollapsed ? (
            <div className="flex rounded-xl bg-white/10 p-0.5">
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-0.5 text-[11px] font-semibold transition-all duration-200 ${
                  !isDark ? `${sbActiveBg} ${sbActiveText} shadow-sm` : `${sbTextMuted} ${sbHoverText}`
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                Light
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-0.5 text-[11px] font-semibold transition-all duration-200 ${
                  isDark ? `${sbActiveBg} ${sbActiveText} shadow-sm` : `${sbTextMuted} ${sbHoverText}`
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                Dark
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition-all duration-200"
              >
                {isDark ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {activeNav.map((item: NavItem) =>
            item.children?.length
              ? renderGroup(item as NavGroupItem)
              : renderLink(item as NavLinkItem)
          )}
        </nav>

        {/* School Info — pinned above user card (frontistirio only) */}
        {!isIdiaiterou && (
          <div
            className="border-t px-2 py-2"
            style={{ borderColor: sbBorderColor }}
          >
            <NavLink
              to="/school-info"
              className={() =>
                [
                  'group flex items-center rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                  location.pathname === '/school-info'
                    ? `${sbActiveBg} ${sbActiveText} shadow-sm shadow-black/10`
                    : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
                ].join(' ')
              }
            >
              <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2'}`}>
                <Building2
                  className={`h-3.5 w-3.5 transition-colors ${
                    location.pathname === '/school-info'
                      ? sbIconActive
                      : `${sbIconInactive} ${sbIconHover}`
                  }`}
                />
              </span>
              {!sidebarCollapsed && <span className="truncate">Πληροφορίες Σχολείου</span>}
              {location.pathname === '/school-info' && !sidebarCollapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sbDotColor }} />
              )}
            </NavLink>
          </div>
        )}

        {/* Tutor Info — pinned above user card (idiaiterou only) */}
        {isIdiaiterou && (
          <div
            className="border-t px-2 py-2"
            style={{ borderColor: sbBorderColor }}
          >
            <NavLink
              to="/tutor-info"
              className={() =>
                [
                  'group flex items-center rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                  location.pathname === '/tutor-info'
                    ? `${sbActiveBg} ${sbActiveText} shadow-sm shadow-black/10`
                    : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
                ].join(' ')
              }
            >
              <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2'}`}>
                <User
                  className={`h-3.5 w-3.5 transition-colors ${
                    location.pathname === '/tutor-info'
                      ? sbIconActive
                      : `${sbIconInactive} ${sbIconHover}`
                  }`}
                />
              </span>
              {!sidebarCollapsed && <span className="truncate">Τα στοιχεία μου</span>}
              {location.pathname === '/tutor-info' && !sidebarCollapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sbDotColor }} />
              )}
            </NavLink>
          </div>
        )}

        {/* User profile — bottom of sidebar */}
        {!sidebarCollapsed && (
          <div
            className="border-t px-3 py-3"
            style={{ borderColor: sbBorderColor }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: sbDotColor,
                }}
              >
                {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <p className={`truncate text-[12px] font-semibold leading-tight ${sbText}`}>
                  {profile?.full_name || user?.email}
                </p>
                <p className={`truncate text-[10px] capitalize leading-tight ${sbTextMuted}`}>
                  {profile?.role || 'no role'}
                </p>
              </div>
              <button
                onClick={signOut}
                aria-label="Αποσύνδεση"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-red-500/20 hover:text-red-100"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Collapsed: avatar + logout stacked */}
        {sidebarCollapsed && (
          <div className="border-t px-2 py-3 flex flex-col items-center gap-2" style={{ borderColor: sbBorderColor }}>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                background: 'rgba(255,255,255,0.16)',
                color: sbDotColor,
              }}
            >
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </div>
            <button
              onClick={signOut}
              aria-label="Αποσύνδεση"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 transition hover:bg-red-500/20 hover:text-red-100"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* ── Main column ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3 md:hidden"
          style={{ background: 'var(--color-sidebar-bg)', borderColor: sbBorderColor }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:text-white"
          >
            <Menu className="h-4 w-4" />
          </button>
          <img
            src={isDark ? logoLight : logoDark}
            alt="edra"
            className="h-8 w-auto"
          />
        </div>

        <div className="page-shell px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
