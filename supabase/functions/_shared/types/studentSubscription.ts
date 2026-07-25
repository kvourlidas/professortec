export type CreateStudentSubscriptionInput = {
  student_id: string;
  package_id: string;
  package_name: string;
  price: number;
  currency: string;
  starts_on: string | null;
  ends_on: string | null;
  discount_reason: string | null;
  renew_from_sub_id: string | null;
};

export type DeleteStudentSubscriptionInput = {
  subscription_id: string;
};

export type CreateStudentSubscriptionPaymentInput = {
  subscription_id: string;
  amount: number;
  payment_method: string;
};

export type CancelStudentSubscriptionPaymentInput = {
  payment_id: string;
};

export type CreateStudentSubscriptionPlanInput = {
  student_id: string;
  package_id: string;
  package_name: string;
  monthly_price: number;
  currency: string;
  start_month: string; // 'YYYY-MM-01'
  end_month: string;   // 'YYYY-MM-01'
  discount_mode: 'none' | 'pct' | 'amount';
  discount_value: number;
  discount_scope: 'range' | 'months';
  discount_months: string[]; // 'YYYY-MM' entries, only used when discount_scope = 'months'
  discount_reason: string | null;
};

export type CancelStudentSubscriptionPlanInput = {
  plan_id: string;
};
