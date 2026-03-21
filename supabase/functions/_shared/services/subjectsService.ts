import {
  insertSubject,
  getSubjectByIdAndSchoolId,
  updateSubjectById,
  deleteSubjectById,
} from "../repositories/subjectsRepo.ts";
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  DeleteSubjectInput,
} from "../types/subjects.ts";

export async function createSubjectService(
  supabase: any,
  schoolId: string,
  input: CreateSubjectInput
) {
  return await insertSubject(supabase, schoolId, input);
}

export async function updateSubjectService(
  supabase: any,
  schoolId: string,
  input: UpdateSubjectInput
) {
  await getSubjectByIdAndSchoolId(supabase, input.subject_id, schoolId);
  return await updateSubjectById(supabase, input);
}

export async function deleteSubjectService(
  supabase: any,
  schoolId: string,
  input: DeleteSubjectInput
) {
  await getSubjectByIdAndSchoolId(supabase, input.subject_id, schoolId);
  await deleteSubjectById(supabase, input.subject_id);
  return { success: true };
}
