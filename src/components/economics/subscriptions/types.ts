export type PackageType = 'monthly' | 'yearly';
export type DiscountMode = 'none' | 'pct' | 'amount';
export type DiscountScope = 'range' | 'months';
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
  starts_on: string | null;
  ends_on: string | null;
  is_custom?: boolean | null;
  avatar_color?: string | null;
};
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer';
export type PaymentRow = {
  id: string;
  subscription_id: string;
  amount: number | null;
  created_at?: string | null;
  payment_method?: PaymentMethod | null;
  cancelled_at?: string | null;
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
  created_at?: string | null;
  charge_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
  discount_pct?: number | null;
  discount_reason?: string | null;
  notes?: string | null;
  plan_id?: string | null;
  period_month?: string | null;
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