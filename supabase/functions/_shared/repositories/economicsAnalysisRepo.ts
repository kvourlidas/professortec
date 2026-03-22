import { NotFoundError } from "../errors.ts";
import type {
  CreateExtraExpenseInput,
  UpdateExtraExpenseInput,
} from "../types/economicsAnalysis.ts";

const EXTRA_EXPENSES_TABLE = "school_extra_expenses";

function hasAll(err: any, ...terms: string[]): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return terms.every((t) => msg.includes(t.toLowerCase()));
}

export async function insertExtraExpense(
  supabase: any,
  schoolId: string,
  input: CreateExtraExpenseInput
) {
  const payload: any = {
    school_id: schoolId,
    occurred_on: input.occurred_on,
    name: input.name,
    amount: input.amount,
    notes: input.notes,
    created_by: input.created_by,
  };

  let res: any = await supabase.from(EXTRA_EXPENSES_TABLE).insert(payload);

  // Fallback: if occurred_on column doesn't exist yet, retry without it
  if (res.error && hasAll(res.error, "occurred_on", "does not exist")) {
    const { occurred_on: _, ...rest } = payload;
    res = await supabase.from(EXTRA_EXPENSES_TABLE).insert(rest);
  }

  if (res.error) {
    throw new Error(res.error.message ?? "Failed to create expense");
  }

  return { success: true };
}

export async function getExtraExpenseByIdAndSchoolId(
  supabase: any,
  expenseId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from(EXTRA_EXPENSES_TABLE)
    .select("id, school_id")
    .eq("id", expenseId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Expense not found or not accessible");
  return data;
}

export async function updateExtraExpenseById(
  supabase: any,
  input: UpdateExtraExpenseInput
) {
  const patch: any = {
    name: input.name,
    amount: input.amount,
    notes: input.notes,
  };
  if (input.occurred_on) patch.occurred_on = input.occurred_on;

  let upd: any = await supabase
    .from(EXTRA_EXPENSES_TABLE)
    .update(patch)
    .eq("id", input.expense_id);

  // Fallback: if occurred_on column doesn't exist yet, retry without it
  if (upd.error && hasAll(upd.error, "occurred_on", "does not exist")) {
    const { occurred_on: _, ...rest } = patch;
    upd = await supabase.from(EXTRA_EXPENSES_TABLE).update(rest).eq("id", input.expense_id);
  }

  if (upd.error) throw new Error(upd.error.message ?? "Failed to update expense");
  return { success: true };
}

export async function deleteExtraExpenseById(
  supabase: any,
  expenseId: string
) {
  const { error } = await supabase
    .from(EXTRA_EXPENSES_TABLE)
    .delete()
    .eq("id", expenseId);

  if (error) throw new Error(error.message ?? "Failed to delete expense");
  return true;
}