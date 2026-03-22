import { updateSchoolInfo } from "../repositories/schoolInfoRepo.ts";
import type { UpdateSchoolInfoInput } from "../types/schoolInfo.ts";

export async function updateSchoolInfoService(
  supabase: any,
  schoolId: string,
  input: UpdateSchoolInfoInput
) {
  return await updateSchoolInfo(supabase, schoolId, input);
}
