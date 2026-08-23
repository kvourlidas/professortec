// src/components/Layout.tsx
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { navItems, idiaiterouNavItems, type NavItem } from '../_nav';
import { ChevronRight, ChevronLeft, Building2, User, HelpCircle } from 'lucide-react';
import edraLogo from '../assets/edra-logo.png';
import logoMark from '../assets/edra-webtab.png';
import TopBar from './TopBar.tsx';

const SIDEBAR_COLLAPSED_KEY = 'pt_sidebar_collapsed_v1';

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
  const { profile } = useAuth();
  const [_schoolName, setSchoolName] = useState<string | null>(null);
  const [sidebarCollapsedPref, setSidebarCollapsedPref] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  // Collapse only makes sense on the persistent desktop sidebar — the mobile
  // drawer always shows full labels regardless of this preference.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const sidebarCollapsed = sidebarCollapsedPref && isDesktop;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>('Μαθήματα');
  const location = useLocation();

  const isIdiaiterou = profile?.account_type === 'idiaiterou';
  const activeNav = isIdiaiterou ? idiaiterouNavItems : navItems;

  // Sidebar background is the blue accent color in both themes, so it always needs
  // white-based text/overlays regardless of light/dark mode.
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

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsedPref((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

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
        {/* Top — branding */}
        <div
          className="flex flex-col gap-2.5 border-b px-3 pt-3 pb-3"
          style={{ borderColor: sbBorderColor }}
        >
          {sidebarCollapsed ? (
            <div className="flex items-center justify-center" style={{ height: '48px' }}>
              <img src={logoMark} alt="edra" className="h-8 w-8 rounded-lg" />
            </div>
          ) : (
            <div className="flex items-center" style={{ height: '48px' }}>
              <img src={edraLogo} alt="edra" className="h-11 w-auto object-contain" draggable={false} />
            </div>
          )}
        </div>

        {/* Collapse toggle — floats on the sidebar's edge, desktop only */}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? 'Επέκταση πλαϊνής μπάρας' : 'Σύμπτυξη πλαϊνής μπάρας'}
          title={sidebarCollapsed ? 'Επέκταση' : 'Σύμπτυξη'}
          className="absolute -right-3 top-14 z-10 hidden h-6 w-6 items-center justify-center rounded-full border shadow-sm transition hover:brightness-110 md:flex"
          style={{ background: 'var(--color-sidebar-bg)', borderColor: sbBorderColor, color: '#fff' }}
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {/* Nav */}
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {activeNav.map((item: NavItem) =>
            item.children?.length
              ? renderGroup(item as NavGroupItem)
              : renderLink(item as NavLinkItem)
          )}
        </nav>

        {/* Help & Support — pinned above school/tutor info */}
        <div
          className="border-t px-2 py-2"
          style={{ borderColor: sbBorderColor }}
        >
          <NavLink
            to="/help"
            className={() =>
              [
                'group flex items-center rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                location.pathname === '/help'
                  ? `${sbActiveBg} ${sbActiveText} shadow-sm shadow-black/10`
                  : `${sbTextMuted} ${sbHoverBg} ${sbHoverText}`,
              ].join(' ')
            }
          >
            <span className={`flex items-center justify-center ${sidebarCollapsed ? 'mx-auto' : 'mr-2'}`}>
              <HelpCircle
                className={`h-3.5 w-3.5 transition-colors ${
                  location.pathname === '/help'
                    ? sbIconActive
                    : `${sbIconInactive} ${sbIconHover}`
                }`}
              />
            </span>
            {!sidebarCollapsed && <span className="truncate">Βοήθεια & Υποστήριξη</span>}
            {location.pathname === '/help' && !sidebarCollapsed && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sbDotColor }} />
            )}
          </NavLink>
        </div>

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

      </aside>

      {/* ── Main column ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} />

        <div className="page-shell px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
