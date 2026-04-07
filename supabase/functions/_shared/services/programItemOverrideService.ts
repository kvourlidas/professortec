import {
  getProgramItemByIdAndSchoolId,
  upsertProgramItemOverride,
} from "../repositories/programItemOverrideRepo.ts";
import type { UpsertProgramItemOverrideInput } from "../types/programItemOverride.ts";

export async function upsertProgramItemOverrideService(
  supabase: any,
  schoolId: string,
  input: UpsertProgramItemOverrideInput
) {
  await getProgramItemByIdAndSchoolId(supabase, input.program_item_id, schoolId);
  return await upsertProgramItemOverride(supabase, input);
}
