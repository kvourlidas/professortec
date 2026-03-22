export type UpsertTutorPaymentProfileInput = {
  tutor_id: string;
  base_gross: number;
  base_net: number;
  currency: string;
  updated_by: string;
};

export type InsertTutorBonusInput = {
  tutor_id: string;
  period_year: number;
  period_month: number;
  kind: 'percent' | 'amount';
  value: number;
  description: string | null;
  created_by: string;
};

export type InsertTutorPaymentInput = {
  tutor_id: string;
  period_year: number;
  period_month: number;
  base_net: number;
  base_gross: number;
  net_total: number;
  gross_total: number;
  bonus_total: number;
  paid_on: string;
  notes: string | null;
  created_by: string;
};

export type CreateTutorPaymentInput = {
  profile: UpsertTutorPaymentProfileInput | null;
  bonus: InsertTutorBonusInput | null;
  payment: InsertTutorPaymentInput;
};

export type UpdateTutorPaymentInput = {
  payment_id: string;
  base_net: number;
  base_gross: number;
  net_total: number;
  gross_total: number;
  bonus_total: number;
  paid_on: string;
  notes: string | null;
};

export type DeleteTutorPaymentInput = {
  payment_id: string;
};
