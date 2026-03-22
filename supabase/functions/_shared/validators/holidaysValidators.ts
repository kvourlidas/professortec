import { ValidationError } from "../errors.ts";
import type { CreateHolidayInput, DeleteHolidayInput } from "../types/holidays.ts";

export function validateCreateHolidayBody(body: any): CreateHolidayInput {
  const rows = body?.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError("Missing or empty rows array");
  }

  const validated = rows.map((row: any, i: number) => {
    const date = row?.date?.trim?.();
    const name = row?.name?.trim?.() || null;

    if (!date) throw new ValidationError(`Missing date at index ${i}`);

    return { date, name };
  });

  return { rows: validated };
}

export function validateDeleteHolidayBody(body: any): DeleteHolidayInput {
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("Missing or empty ids array");
  }

  return { ids };
}
