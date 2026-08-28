import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  School,
  Users,
  Users2,
  BookOpen,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Wallet,
  Package,
  WalletCards,
  HandCoins,
  TrendingUp,
  Smartphone,
  MessageSquareText,
  Bell,
} from 'lucide-react';

export type NavItem = {
  label: string;
  to?: string;
  icon?: LucideIcon;
  children?: NavItem[];
};

export const idiaiterouNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ημερολόγιο',
    to: '/calendar',
    icon: CalendarDays,
  },
  {
    label: 'Πρόγραμμα',
    to: '/program',
    icon: CalendarDays,
  },
  {
    label: 'Παρουσίες',
    to: '/attendance',
    icon: ClipboardCheck,
  },
  {
    label: 'Μαθητές',
    to: '/students',
    icon: Users,
  },
  {
    label: 'Μαθήματα',
    to: '/subjects',
    icon: BookOpen,
  },
  {
    label: 'Αργίες',
    to: '/program/holidays',
    icon: CalendarX2,
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
  {
    label: 'Οικονομικά',
    to: '/economics/analysis',
    icon: Wallet,
  },
  {
    label: 'Εφαρμογή μαθητών',
    icon: Smartphone,
    children: [
      {
        label: 'Feedback μαθητών',
        to: '/student-app/feedback',
        icon: MessageSquareText,
      },
      {
        label: 'Μηνύματα μαθητών',
        to: '/student-app/messages',
        icon: MessageSquareText,
      },
      {
        label: 'Ειδοποιήσεις μαθητών',
        to: '/student-app/notifications',
        icon: Bell,
      },
    ],
  },
];

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ημερολόγιο',
    to: '/calendar',
    icon: CalendarDays,
  },
  {
    label: 'Παρουσίες',
    to: '/attendance',
    icon: ClipboardCheck,
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
    label: 'Τμήματα',
    to: '/classes',
    icon: School,
  },
  {
    label: 'Μαθήματα',
    to: '/subjects',
    icon: BookOpen,
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

  // ✅ Student App
  {
    label: 'Εφαρμογή μαθητών',
    icon: Smartphone,
    children: [
      {
        label: 'Feedback μαθητών',
        to: '/student-app/feedback',
        icon: MessageSquareText,
      },
      {
        label: 'Μηνύματα μαθητών',
        to: '/student-app/messages',
        icon: MessageSquareText,
      },
      {
        label: 'Ειδοποιήσεις μαθητών',
        to: '/student-app/notifications',
        icon: Bell,
      },
    ],
  },

  // ✅ Economics
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
      {
        label: 'Πληρωμές Καθηγητών',
        to: '/economics/tutors-payments',
        icon: HandCoins,
      },
      {
        label: 'Ανάλυση Οικονομικών',
        to: '/economics/analysis',
        icon: TrendingUp,
      },
    ],
  },
];
