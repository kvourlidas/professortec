import {
  insertStudent,
  getStudentByIdAndSchoolId,
  updateStudentById,
} from "../repositories/studentsRepo.ts";
import type {
  CreateStudentInput,
  UpdateStudentInput,
} from "../types/students.ts";
import { deleteStudentById } from "../repositories/studentsRepo.ts";
import type { DeleteStudentInput } from "../types/students.ts";

export async function createStudentService(
  supabase: any,
  schoolId: string,
  input: CreateStudentInput
) {
  return await insertStudent(supabase, schoolId, input);
}

export async function updateStudentService(
  supabase: any,
  schoolId: string,
  input: UpdateStudentInput
) {
  await getStudentByIdAndSchoolId(supabase, input.student_id, schoolId);
  return await updateStudentById(supabase, input);
}


export async function deleteStudentService(
  supabase: any,
  schoolId: string,
  input: DeleteStudentInput
) {
  await getStudentByIdAndSchoolId(supabase, input.student_id, schoolId);
  await deleteStudentById(supabase, input.student_id);
  return { success: true };
}