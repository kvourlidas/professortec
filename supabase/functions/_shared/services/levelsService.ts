import {
  insertLevel,
  getLevelByIdAndSchoolId,
  searchLevelsByName,
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

export type ResolveLevelResult =
  | { status: "found"; id: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; name: string }[] };

export async function resolveLevelIdByName(
  supabase: any,
  schoolId: string,
  name: string
): Promise<ResolveLevelResult> {
  const matches = await searchLevelsByName(supabase, schoolId, name);
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return { status: "found", id: matches[0].id };
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
