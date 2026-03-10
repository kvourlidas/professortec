import {
  insertClass,
  getClassByIdAndSchoolId,
  updateClassById,
  deleteClassById,
} from "../repositories/classesRepo.ts";
import type {
  CreateClassInput,
  UpdateClassInput,
  DeleteClassInput,
} from "../types/classes.ts";

export async function createClassService(
  supabase: any,
  schoolId: string,
  input: Omit<CreateClassInput, "school_id">
) {
  return await insertClass(supabase, {
    ...input,
    school_id: schoolId,
  });
}

export async function updateClassService(
  supabase: any,
  schoolId: string,
  input: UpdateClassInput
) {
  await getClassByIdAndSchoolId(supabase, input.class_id, schoolId);
  return await updateClassById(supabase, input);
}

export async function deleteClassService(
  supabase: any,
  schoolId: string,
  input: DeleteClassInput
) {
  await getClassByIdAndSchoolId(supabase, input.class_id, schoolId);
  await deleteClassById(supabase, input.class_id);
  return { success: true };
}