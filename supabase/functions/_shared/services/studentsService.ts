import {
  insertStudent,
  getStudentByIdAndSchoolId,
  getStudentFullByIdAndSchoolId,
  searchStudentsByName,
  updateStudentById,
} from "../repositories/studentsRepo.ts";
import { resolveLevelIdByName } from "./levelsService.ts";
import type {
  CreateStudentInput,
  UpdateStudentInput,
} from "../types/students.ts";
import { deleteStudentById } from "../repositories/studentsRepo.ts";
import type { DeleteStudentInput } from "../types/students.ts";
import { ValidationError } from "../errors.ts";

export async function createStudentService(
  supabase: any,
  schoolId: string,
  input: CreateStudentInput
) {
  return await insertStudent(supabase, schoolId, input);
}

export type CreateStudentByNameResult =
  | { status: "created"; item: unknown }
  | { status: "level_not_found" }
  | { status: "level_ambiguous"; candidates: { id: string; name: string }[] };

/**
 * Same as createStudentService, but resolves level_name (as typed by the AI
 * assistant) to a level_id first instead of requiring the caller to already
 * know the UUID.
 */
export async function createStudentWithLevelNameService(
  supabase: any,
  schoolId: string,
  params: { level_name?: string; student: CreateStudentInput }
): Promise<CreateStudentByNameResult> {
  let levelId: string | null = null;

  if (params.level_name) {
    const levelResult = await resolveLevelIdByName(supabase, schoolId, params.level_name);
    if (levelResult.status === "not_found") return { status: "level_not_found" };
    if (levelResult.status === "ambiguous") return { status: "level_ambiguous", candidates: levelResult.candidates };
    levelId = levelResult.id;
  }

  const item = await insertStudent(supabase, schoolId, { ...params.student, level_id: levelId });
  return { status: "created", item };
}

export async function updateStudentService(
  supabase: any,
  schoolId: string,
  input: UpdateStudentInput
) {
  await getStudentByIdAndSchoolId(supabase, input.student_id, schoolId);
  return await updateStudentById(supabase, input);
}


export type StudentPartialUpdate = {
  full_name?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  special_notes?: string;
  father_name?: string;
  father_date_of_birth?: string;
  father_phone?: string;
  father_email?: string;
  mother_name?: string;
  mother_date_of_birth?: string;
  mother_phone?: string;
  mother_email?: string;
};

export type UpdateStudentByNameResult =
  | { status: "updated"; item: unknown }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; full_name: string; phone: string | null; email: string | null }[] }
  | { status: "level_not_found" }
  | { status: "level_ambiguous"; candidates: { id: string; name: string }[] };

/**
 * Resolves a student by id or by (partial) name, merges only the provided
 * fields onto the student's current row, and updates it. updateStudentById
 * overwrites every column, so any field not explicitly passed here must be
 * carried forward from the current row or it would be wiped to null.
 */
export async function updateStudentByNameService(
  supabase: any,
  schoolId: string,
  params: { student_id?: string; student_name?: string; level_name?: string; updates: StudentPartialUpdate }
): Promise<UpdateStudentByNameResult> {
  let studentId = params.student_id;

  if (!studentId) {
    if (!params.student_name) {
      throw new ValidationError("Missing student_id or student_name");
    }
    const matches = await searchStudentsByName(supabase, schoolId, params.student_name);
    if (matches.length === 0) return { status: "not_found" };
    if (matches.length > 1) return { status: "ambiguous", candidates: matches };
    studentId = matches[0].id;
  }

  let levelId: string | undefined;
  if (params.level_name) {
    const levelResult = await resolveLevelIdByName(supabase, schoolId, params.level_name);
    if (levelResult.status === "not_found") return { status: "level_not_found" };
    if (levelResult.status === "ambiguous") return { status: "level_ambiguous", candidates: levelResult.candidates };
    levelId = levelResult.id;
  }

  const current = await getStudentFullByIdAndSchoolId(supabase, studentId, schoolId);
  const { updates } = params;

  const merged: UpdateStudentInput = {
    student_id: studentId,
    full_name: updates.full_name ?? current.full_name,
    date_of_birth: updates.date_of_birth ?? current.date_of_birth,
    phone: updates.phone ?? current.phone,
    email: updates.email ?? current.email,
    special_notes: updates.special_notes ?? current.special_notes,
    level_id: levelId ?? current.level_id,
    father_name: updates.father_name ?? current.father_name,
    father_date_of_birth: updates.father_date_of_birth ?? current.father_date_of_birth,
    father_phone: updates.father_phone ?? current.father_phone,
    father_email: updates.father_email ?? current.father_email,
    mother_name: updates.mother_name ?? current.mother_name,
    mother_date_of_birth: updates.mother_date_of_birth ?? current.mother_date_of_birth,
    mother_phone: updates.mother_phone ?? current.mother_phone,
    mother_email: updates.mother_email ?? current.mother_email,
  };

  const item = await updateStudentById(supabase, merged);
  return { status: "updated", item };
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