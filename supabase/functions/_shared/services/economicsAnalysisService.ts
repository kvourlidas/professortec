import {
  insertExtraExpense,
  getExtraExpenseByIdAndSchoolId,
  updateExtraExpenseById,
  deleteExtraExpenseById,
} from "../repositories/economicsAnalysisRepo.ts";
import type {
  CreateExtraExpenseInput,
  UpdateExtraExpenseInput,
  DeleteExtraExpenseInput,
} from "../types/economicsAnalysis.ts";

export async function createExtraExpenseService(
  supabase: any,
  schoolId: string,
  input: CreateExtraExpenseInput
) {
  return await insertExtraExpense(supabase, schoolId, input);
}

export async function updateExtraExpenseService(
  supabase: any,
  schoolId: string,
  input: UpdateExtraExpenseInput
) {
  await getExtraExpenseByIdAndSchoolId(supabase, input.expense_id, schoolId);
  return await updateExtraExpenseById(supabase, input);
}

export async function deleteExtraExpenseService(
  supabase: any,
  schoolId: string,
  input: DeleteExtraExpenseInput
) {
  await getExtraExpenseByIdAndSchoolId(supabase, input.expense_id, schoolId);
  await deleteExtraExpenseById(supabase, input.expense_id);
  return { success: true };
}
