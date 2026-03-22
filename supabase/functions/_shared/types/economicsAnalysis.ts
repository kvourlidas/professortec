export type CreateExtraExpenseInput = {
  occurred_on: string | null;
  name: string;
  amount: number;
  notes: string | null;
  created_by: string;
};

export type UpdateExtraExpenseInput = {
  expense_id: string;
  name: string;
  amount: number;
  occurred_on: string | null;
  notes: string | null;
};

export type DeleteExtraExpenseInput = {
  expense_id: string;
};
