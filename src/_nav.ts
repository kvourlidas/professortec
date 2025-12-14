// src/_nav.ts
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  School,
  Users,
  Users2,
  BookOpen,
  Layers3,
  NotebookTabs,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  BarChart3,
  Wallet,
  Package,
  WalletCards, // ✅ NEW
} from 'lucide-react';

export type NavItem = {
  label: string;
  to?: string;
  icon?: LucideIcon;
  children?: NavItem[];
};

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Τμήματα',
    to: '/classes',
    icon: School,
  },
  {
    label: 'Μαθητές',
    to: '/students',
    icon: Users,
  },
  {
    label: 'Καθηγητές',
    to: '/tutors',
    icon: Users2,
  },
  {
    label: 'Μαθήματα',
    icon: BookOpen,
    children: [
      {
        label: 'Επίπεδα',
        to: '/levels',
        icon: Layers3,
      },
      {
        label: 'Μαθήματα',
        to: '/subjects',
        icon: NotebookTabs,
      },
    ],
  },
  {
    label: 'Προγράμματα',
    icon: CalendarDays,
    children: [
      {
        label: 'Πρόγραμμα',
        to: '/program',
        icon: CalendarDays,
      },
      {
        label: 'Εκδηλώσεις',
        to: '/program/events',
        icon: CalendarDays,
      },
      {
        label: 'Αργίες',
        to: '/program/holidays',
        icon: CalendarX2,
      },
    ],
  },
  {
    label: 'Διαγωνίσματα',
    to: '/program/tests',
    icon: ClipboardList,
  },
  {
    label: 'Βαθμοί',
    to: '/grades',
    icon: BarChart3,
  },

  // ✅ LAST: Economics
  {
    label: 'Οικονομικά',
    icon: Wallet,
    children: [
      {
        label: 'Πακέτα Συνδρομών',
        to: '/economics/package-subscriptions',
        icon: Package,
      },
      {
        label: 'Συνδρομές Μαθητών',
        to: '/economics/student-subscriptions',
        icon: WalletCards,
      },
    ],
  },
];
