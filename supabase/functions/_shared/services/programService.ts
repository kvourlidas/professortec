import {
  insertProgram,
  getProgramByIdAndSchoolId,
  updateProgramById,
  deleteProgramById,
} from "../repositories/programRepo.ts";
import type {
  CreateProgramInput,
  UpdateProgramInput,
  DeleteProgramInput,
} from "../types/program.ts";

export async function createProgramService(
  supabase: any,
  input: CreateProgramInput
) {
  return await insertProgram(supabase, input);
}

export async function updateProgramService(
  supabase: any,
  schoolId: string,
  input: UpdateProgramInput
) {
  await getProgramByIdAndSchoolId(supabase, input.program_item_id, schoolId);
  return await updateProgramById(supabase, input);
}

export async function deleteProgramService(
  supabase: any,
  schoolId: string,
  input: DeleteProgramInput
) {
  await getProgramByIdAndSchoolId(supabase, input.program_item_id, schoolId);
  await deleteProgramById(supabase, input.program_item_id);
  return { success: true };
}
