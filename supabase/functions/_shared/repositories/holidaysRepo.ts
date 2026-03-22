import type { CreateHolidayInput, DeleteHolidayInput } from "../types/holidays.ts";

export async function upsertHolidays(
  supabase: any,
  schoolId: string,
  input: CreateHolidayInput
) {
  const rows = input.rows.map((r) => ({
    school_id: schoolId,
    date: r.date,
    name: r.name,
  }));

  const { data, error } = await supabase
    .from("school_holidays")
    .upsert(rows, { onConflict: "school_id,date" })
    .select("*");

  if (error) {
    throw new Error(error.message ?? "Failed to save holidays");
  }

  return data ?? [];
}

export async function deleteHolidaysByIds(
  supabase: any,
  schoolId: string,
  input: DeleteHolidayInput
) {
  const { error } = await supabase
    .from("school_holidays")
    .delete()
    .in("id", input.ids)
    .eq("school_id", schoolId);

  if (error) {
    throw new Error(error.message ?? "Failed to delete holidays");
  }

  return true;
}
