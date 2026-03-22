import {
  upsertHolidays,
  deleteHolidaysByIds,
} from "../repositories/holidaysRepo.ts";
import type {
  CreateHolidayInput,
  DeleteHolidayInput,
} from "../types/holidays.ts";

export async function createHolidayService(
  supabase: any,
  schoolId: string,
  input: CreateHolidayInput
) {
  return await upsertHolidays(supabase, schoolId, input);
}

export async function deleteHolidayService(
  supabase: any,
  schoolId: string,
  input: DeleteHolidayInput
) {
  await deleteHolidaysByIds(supabase, schoolId, input);
  return { success: true };
}
