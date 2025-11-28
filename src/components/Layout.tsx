import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { navItems, type NavItem } from '../_nav';
import { Menu, LogOut } from 'lucide-react';

/**
 * Local type aliases to avoid importing non-exported types from ../_nav.
 * NavItem is imported from ../_nav and we extend it with the shape used in this file.
 */
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
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>('Subjects'); // default open

  useEffect(() => {
    const loadSchoolName = async () => {
      if (!profile?.school_id) return;

      const { data, error } = await supabase
        .from('schools')
        .select('name')
        .eq('id', profile.school_id)
        .maybeSingle();

      if (!error && data?.name) {
        setSchoolName(data.name);
      }
    };

    loadSchoolName();
  }, [profile?.school_id]);

  const renderLink = (item: NavLinkItem) => {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          [
            'flex items-center rounded-lg px-3 py-2',
            isActive
              ? 'bg-sidebar-muted text-white'
              : 'text-slate-200 hover:bg-sidebar-muted hover:text-white',
          ].join(' ')
        }
      >
        {Icon && (
          <span
            className={`flex items-center justify-center ${
              sidebarCollapsed ? 'mx-auto' : 'mr-3'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}

        {!sidebarCollapsed && <span>{item.label}</span>}
      </NavLink>
    );
  };

  const renderGroup = (item: NavGroupItem) => {
    const Icon = item.icon;
    const isOpen = openGroup === item.label;

    return (
      <div key={item.label}>
        <button
          type="button"
          onClick={() => setOpenGroup(isOpen ? null : item.label)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-slate-200 hover:bg-sidebar-muted hover:text-white"
        >
          <span className="flex items-center">
            {Icon && (
              <span
                className={`flex items-center justify-center ${
                  sidebarCollapsed ? 'mx-auto' : 'mr-3'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            {!sidebarCollapsed && <span>{item.label}</span>}
          </span>

          {/* little arrow only when expanded */}
          {!sidebarCollapsed && (
            <span
              className={`ml-2 text-[10px] transition-transform ${
                isOpen ? 'rotate-90' : ''
              }`}
            >
              ▸
            </span>
          )}
        </button>

        {/* children only visible if sidebar expanded & group open */}
        {isOpen && !sidebarCollapsed && (
          <div className="mt-1 space-y-1 pl-7 text-xs">
            {item.children.map((child: NavLinkItem) => {
              const ChildIcon = child.icon;
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center rounded-lg px-3 py-1',
                      isActive
                        ? 'bg-sidebar-muted text-white'
                        : 'text-slate-300 hover:bg-sidebar-muted hover:text-white',
                    ].join(' ')
                  }
                >
                  {ChildIcon && (
                    <span className="mr-2 flex items-center justify-center">
                      <ChildIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="truncate">{child.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    // 👇 full viewport, no window scroll – only internal scroll
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`hidden md:flex h-full flex-shrink-0 flex-col border-r ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
        style={{
          backgroundColor: 'var(--color-sidebar)',
          borderColor: 'var(--color-sidebar-border)',
          color: 'white',
        }}
      >
        {/* Toggle INSIDE sidebar, top-right */}
        <div className="flex items-center justify-end border-b border-slate-700 px-3 py-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600"
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* if sidebar ever gets tall, it can scroll independently */}
        <nav className="mt-2 flex-1 space-y-1 px-2 text-sm overflow-y-auto">
          {navItems.map((item: NavItem) =>
            'children' in item && item.children
              ? renderGroup(item as NavGroupItem)
              : renderLink(item as NavLinkItem),
          )}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="app-header flex-shrink-0">
          <div>
            <span className="app-header-title">{APP_NAME}</span>
            {schoolName && (
              <span className="app-header-subtitle"> · {schoolName}</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <div className="font-medium">
                {profile?.full_name || user?.email}
              </div>
              <div className="opacity-80">
                {profile?.role || 'no role'}
              </div>
            </div>
            <button
              onClick={signOut}
              className="logout-btn"
              aria-label="Αποσύνδεση"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* scroll area */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  );
}
