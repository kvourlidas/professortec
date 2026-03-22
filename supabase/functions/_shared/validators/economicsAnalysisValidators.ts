import { ValidationError } from "../errors.ts";
import type {
  CreateExtraExpenseInput,
  UpdateExtraExpenseInput,
  DeleteExtraExpenseInput,
} from "../types/economicsAnalysis.ts";

export function validateCreateExtraExpenseBody(body: any): CreateExtraExpenseInput {
  const name = body?.name?.trim?.();
  if (!name) throw new ValidationError("Missing name");

  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("Amount must be > 0");

  const created_by = body?.created_by?.trim?.();
  if (!created_by) throw new ValidationError("Missing created_by");

  return {
    occurred_on: body?.occurred_on?.trim?.() || null,
    name,
    amount,
    notes: body?.notes?.trim?.() || null,
    created_by,
  };
}

export function validateUpdateExtraExpenseBody(body: any): UpdateExtraExpenseInput {
  const expense_id = body?.expense_id?.trim?.();
  if (!expense_id) throw new ValidationError("Missing expense_id");

  const name = body?.name?.trim?.();
  if (!name) throw new ValidationError("Missing name");

  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("Amount must be > 0");

  return {
    expense_id,
    name,
    amount,
    occurred_on: body?.occurred_on?.trim?.() || null,
    notes: body?.notes?.trim?.() || null,
  };
}

export function validateDeleteExtraExpenseBody(body: any): DeleteExtraExpenseInput {
  const expense_id = body?.expense_id?.trim?.();
  if (!expense_id) throw new ValidationError("Missing expense_id");
  return { expense_id };
}
