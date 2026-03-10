import type { CreateStudentInput } from "../types/students.ts";
import { NotFoundError } from "../errors.ts";
import type { UpdateStudentInput } from "../types/students.ts";

export async function insertStudent(
  supabase: any,
  schoolId: string,
  input: CreateStudentInput
) {
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      ...input,
    })
    .select(`
      id,
      school_id,
      full_name,
      date_of_birth,
      phone,
      email,
      special_notes,
      level_id,
      father_name,
      father_date_of_birth,
      father_phone,
      father_email,
      mother_name,
      mother_date_of_birth,
      mother_phone,
      mother_email,
      created_at
    `)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create student");
  }

  return data;
}

export async function getStudentByIdAndSchoolId(
  supabase: any,
  studentId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Student not found or not accessible");
  }

  return data;
}

export async function updateStudentById(
  supabase: any,
  input: UpdateStudentInput
) {
  const { data, error } = await supabase
    .from("students")
    .update({
      full_name: input.full_name,
      date_of_birth: input.date_of_birth,
      phone: input.phone,
      email: input.email,
      special_notes: input.special_notes,
      level_id: input.level_id,
      father_name: input.father_name,
      father_date_of_birth: input.father_date_of_birth,
      father_phone: input.father_phone,
      father_email: input.father_email,
      mother_name: input.mother_name,
      mother_date_of_birth: input.mother_date_of_birth,
      mother_phone: input.mother_phone,
      mother_email: input.mother_email,
    })
    .eq("id", input.student_id)
    .select(`
      id,
      school_id,
      full_name,
      date_of_birth,
      phone,
      email,
      special_notes,
      level_id,
      father_name,
      father_date_of_birth,
      father_phone,
      father_email,
      mother_name,
      mother_date_of_birth,
      mother_phone,
      mother_email,
      created_at
    `)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update student");
  }

  return data;
}


export async function deleteStudentById(
  supabase: any,
  studentId: string
) {
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}