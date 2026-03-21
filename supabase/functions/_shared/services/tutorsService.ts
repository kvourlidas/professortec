import {
  insertTutor,
  getTutorByIdAndSchoolId,
  updateTutorById,
  deleteTutorById,
} from "../repositories/tutorsRepo.ts";
import type {
  CreateTutorInput,
  UpdateTutorInput,
  DeleteTutorInput,
} from "../types/tutors.ts";

export async function createTutorService(
  supabase: any,
  schoolId: string,
  input: CreateTutorInput
) {
  return await insertTutor(supabase, schoolId, input);
}

export async function updateTutorService(
  supabase: any,
  schoolId: string,
  input: UpdateTutorInput
) {
  await getTutorByIdAndSchoolId(supabase, input.tutor_id, schoolId);
  return await updateTutorById(supabase, input);
}

export async function deleteTutorService(
  supabase: any,
  schoolId: string,
  input: DeleteTutorInput
) {
  await getTutorByIdAndSchoolId(supabase, input.tutor_id, schoolId);
  await deleteTutorById(supabase, input.tutor_id);
  return { success: true };
}
