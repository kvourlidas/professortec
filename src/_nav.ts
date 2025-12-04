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
  CalendarX2, // icon for holidays
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
    label: 'Μαθήματα', // group
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
    label: 'Προγράμματα', // group
    icon: CalendarDays,
    children: [
      {
        label: 'Πρόγραμμα',
        to: '/program',
        icon: CalendarDays,
      },
      {
        label: 'Εκδηλώσεις',   // 👈 NEW item
        to: '/program/events', // 👈 MUST match App.tsx route
        icon: CalendarDays,
      },
      {
        label: 'Αργίες',
        to: '/program/holidays',
        icon: CalendarX2,
      },
    ],
  },
];
