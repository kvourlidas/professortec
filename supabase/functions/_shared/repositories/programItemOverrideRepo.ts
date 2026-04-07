import { NotFoundError } from "../errors.ts";
import type { UpsertProgramItemOverrideInput } from "../types/programItemOverride.ts";

export async function getProgramItemByIdAndSchoolId(
  supabase: any,
  programItemId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("program_items")
    .select("id, program_id, programs!inner(school_id)")
    .eq("id", programItemId)
    .eq("programs.school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Program item not found or not accessible");

  return data;
}

export async function upsertProgramItemOverride(
  supabase: any,
  input: UpsertProgramItemOverrideInput
) {
  const { data: existing, error: findErr } = await supabase
    .from("program_item_overrides")
    .select("id")
    .eq("program_item_id", input.program_item_id)
    .eq("override_date", input.override_date)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);

  if (existing) {
    const { data, error } = await supabase
      .from("program_item_overrides")
      .update({
        start_time: input.start_time,
        end_time: input.end_time,
        is_deleted: input.is_deleted,
        is_inactive: input.is_inactive,
        holiday_active_override: input.holiday_active_override,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to update program item override");
    return data;
  }

  const { data, error } = await supabase
    .from("program_item_overrides")
    .insert({
      program_item_id: input.program_item_id,
      override_date: input.override_date,
      start_time: input.start_time,
      end_time: input.end_time,
      is_deleted: input.is_deleted,
      is_inactive: input.is_inactive,
      holiday_active_override: input.holiday_active_override,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to insert program item override");
  return data;
}
