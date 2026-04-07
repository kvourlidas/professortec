import { ValidationError } from "../errors.ts";
import type { UpsertProgramItemOverrideInput } from "../types/programItemOverride.ts";

export function validateUpsertProgramItemOverrideBody(body: any): UpsertProgramItemOverrideInput {
  const program_item_id = body?.program_item_id?.trim?.();
  const override_date = body?.override_date?.trim?.();
  const start_time = body?.start_time?.trim?.() || null;
  const end_time = body?.end_time?.trim?.() || null;
  const is_deleted = typeof body?.is_deleted === "boolean" ? body.is_deleted : false;
  const is_inactive = typeof body?.is_inactive === "boolean" ? body.is_inactive : false;
  const holiday_active_override = typeof body?.holiday_active_override === "boolean" ? body.holiday_active_override : false;

  if (!program_item_id) throw new ValidationError("Missing program_item_id");
  if (!override_date) throw new ValidationError("Missing override_date");

  return { program_item_id, override_date, start_time, end_time, is_deleted, is_inactive, holiday_active_override };
}
