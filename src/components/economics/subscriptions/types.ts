export type StudentRow      = { id: string; school_id: string; full_name: string | null };
export type PackageType     = 'hourly' | 'monthly' | 'yearly';
export type PackageRow      = { id: string; school_id: string; name: string; price: number; currency: string; is_active: boolean; sort_order: number; package_type?: PackageType | null; hours?: number | null; created_at?: string | null };
export type SubscriptionRow = { id: string; school_id: string; student_id: string; package_id: string | null; package_name: string; price: number; currency: string; status: 'active' | 'completed' | 'canceled'; starts_on: string | null; ends_on: string | null; created_at: string | null; used_hours?: number | null; charge_amount?: number | null; paid_amount?: number | null; balance?: number | null };
export type PaymentRow      = { subscription_id: string; amount: number; created_at: string | null };
export type StudentViewRow  = { student_id: string; student_name: string; sub: SubscriptionRow | null; paid: number; balance: number; payments: PaymentRow[] };
export type PeriodMode      = 'month' | 'range';
export type SubModal        = { pkgId: string; pkgName: string; prevPkgId: string };
