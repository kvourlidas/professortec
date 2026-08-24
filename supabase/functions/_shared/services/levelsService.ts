import {
  insertLevel,
  getLevelByIdAndSchoolId,
  updateLevelById,
  deleteLevelById,
} from "../repositories/levelsRepo.ts";
import type {
  CreateLevelInput,
  UpdateLevelInput,
  DeleteLevelInput,
} from "../types/levels.ts";

export async function createLevelService(
  supabase: any,
  schoolId: string,
  input: CreateLevelInput
) {
  return await insertLevel(supabase, schoolId, input);
}

export async function updateLevelService(
  supabase: any,
  schoolId: string,
  input: UpdateLevelInput
) {
  await getLevelByIdAndSchoolId(supabase, input.level_id, schoolId);
  return await updateLevelById(supabase, input);
}

export async function deleteLevelService(
  supabase: any,
  schoolId: string,
  input: DeleteLevelInput
) {
  await getLevelByIdAndSchoolId(supabase, input.level_id, schoolId);
  await deleteLevelById(supabase, input.level_id);
  return { success: true };
}
