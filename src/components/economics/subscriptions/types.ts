export type PeriodMode = 'range' | 'month';
export type PackageType = 'hourly' | 'monthly' | 'yearly';
export type PackageRow = {
  id: string;
  school_id: string;
  name: string;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  package_type: PackageType | null | undefined;
  hours: number | null;
  starts_on: string | null;
  ends_on: string | null;
  is_custom?: boolean | null;
  avatar_color?: string | null;
};
export type PaymentRow = {
  subscription_id: string;
  amount: number | null;
  created_at?: string | null;
};
export type StudentRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};
export type SubscriptionRow = {
  id: string;
  school_id: string;
  student_id: string;
  package_id: string | null;
  package_name: string;
  price: number;
  currency: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at?: string;
  used_hours?: number | null;
  charge_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
};
export type StudentViewRow = {
  student_id: string;
  student_name: string;
  sub: SubscriptionRow;
  paid: number;
  balance: number;
  payments: PaymentRow[];
  carriedDebt?: { amount: number; fromName: string } | null;
};
export type SubModal = {
  pkgId: string;
  pkgName: string;
  prevPkgId: string;
};