export type Mode = 'month' | 'year' | 'range';
export type TxKind = 'income' | 'expense';
export type TxSource = 'student_subscription' | 'tutor_payment' | 'extra_expense';

export type TxRow = {
  id: string;
  kind: TxKind;
  source: TxSource;
  date: string;
  amount: number;
  label: string;
  notes?: string | null;
  category?: string | null;
};

export type ExtraExpenseRow = {
  id: string;
  school_id: string;
  occurred_on?: string | null;
  name: string;
  amount: number;
  notes?: string | null;
  created_at?: string;
  created_by?: string | null;
};

export type Point = {
  label: string;
  value: number;
  title?: string;
};
