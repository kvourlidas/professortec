import { navItems, idiaiterouNavItems, type NavItem } from './_nav';

// Routes not present in the sidebar nav (pinned links, detail pages, etc.)
const EXTRA_TITLES: { to: string; label: string }[] = [
  { to: '/school-info', label: 'Πληροφορίες Σχολείου' },
  { to: '/tutor-info', label: 'Τα στοιχεία μου' },
  { to: '/help', label: 'Βοήθεια & Υποστήριξη' },
  { to: '/students', label: 'Μαθητές' },
];

function flatten(items: NavItem[]): { to: string; label: string }[] {
  return items.flatMap((item) => {
    const self = item.to ? [{ to: item.to, label: item.label }] : [];
    const children = item.children ? flatten(item.children) : [];
    return [...self, ...children];
  });
}

const ALL_TITLES = [...flatten(navItems), ...flatten(idiaiterouNavItems), ...EXTRA_TITLES];

export function getPageTitle(pathname: string): string | null {
  const exact = ALL_TITLES.find((t) => t.to === pathname);
  if (exact) return exact.label;

  const prefixMatches = ALL_TITLES.filter((t) => pathname.startsWith(t.to + '/'));
  if (prefixMatches.length === 0) return null;

  return prefixMatches.reduce((best, cur) => (cur.to.length > best.to.length ? cur : best)).label;
}
