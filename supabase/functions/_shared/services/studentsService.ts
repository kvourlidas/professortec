import {
  insertStudent,
  getStudentByIdAndSchoolId,
  getStudentFullByIdAndSchoolId,
  searchStudentsByName,
  updateStudentById,
} from "../repositories/studentsRepo.ts";
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
  | { status: "needs_level_selection"; merged: UpdateStudentInput };

/**
 * Resolves a student by id or by (partial) name, merges only the provided
 * fields onto the student's current row, and updates it — unless
 * change_level is set, in which case it stops short of writing and returns
 * the merged row (still carrying the student's current level_id) for the
 * caller to swap in a UI-picked level before saving. updateStudentById
 * overwrites every column, so any field not explicitly passed here must be
 * carried forward from the current row or it would be wiped to null.
 */
export async function updateStudentByNameService(
  supabase: any,
  schoolId: string,
  params: { student_id?: string; student_name?: string; change_level?: boolean; updates: StudentPartialUpdate }
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

  const current = await getStudentFullByIdAndSchoolId(supabase, studentId, schoolId);
  const { updates } = params;

  const merged: UpdateStudentInput = {
    student_id: studentId,
    full_name: updates.full_name ?? current.full_name,
    date_of_birth: updates.date_of_birth ?? current.date_of_birth,
    phone: updates.phone ?? current.phone,
    email: updates.email ?? current.email,
    special_notes: updates.special_notes ?? current.special_notes,
    level_id: current.level_id,
    father_name: updates.father_name ?? current.father_name,
    father_date_of_birth: updates.father_date_of_birth ?? current.father_date_of_birth,
    father_phone: updates.father_phone ?? current.father_phone,
    father_email: updates.father_email ?? current.father_email,
    mother_name: updates.mother_name ?? current.mother_name,
    mother_date_of_birth: updates.mother_date_of_birth ?? current.mother_date_of_birth,
    mother_phone: updates.mother_phone ?? current.mother_phone,
    mother_email: updates.mother_email ?? current.mother_email,
  };

  if (params.change_level) {
    return { status: "needs_level_selection", merged };
  }

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

export type DeleteStudentByNameResult =
  | { status: "deleted"; student_id: string; full_name: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; full_name: string; phone: string | null; email: string | null }[] };

/**
 * Resolves a student by id or by (partial) name, then soft-deletes it.
 */
export async function deleteStudentByNameService(
  supabase: any,
  schoolId: string,
  params: { student_id?: string; student_name?: string }
): Promise<DeleteStudentByNameResult> {
  let studentId = params.student_id;
  let fullName: string | undefined;

  if (!studentId) {
    if (!params.student_name) {
      throw new ValidationError("Missing student_id or student_name");
    }
    const matches = await searchStudentsByName(supabase, schoolId, params.student_name);
    if (matches.length === 0) return { status: "not_found" };
    if (matches.length > 1) return { status: "ambiguous", candidates: matches };
    studentId = matches[0].id;
    fullName = matches[0].full_name;
  }

  if (!fullName) {
    const full = await getStudentFullByIdAndSchoolId(supabase, studentId, schoolId);
    fullName = full.full_name;
  } else {
    await getStudentByIdAndSchoolId(supabase, studentId, schoolId);
  }

  await deleteStudentById(supabase, studentId);
  return { status: "deleted", student_id: studentId, full_name: fullName! };
}