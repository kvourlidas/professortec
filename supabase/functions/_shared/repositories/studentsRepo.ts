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
      address,
      school_name,
      auth_user_id,
      current_password,
      father_name,
      father_date_of_birth,
      father_phone,
      father_email,
      father_afm,
      mother_name,
      mother_date_of_birth,
      mother_phone,
      mother_email,
      mother_afm,
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
      address: input.address,
      school_name: input.school_name,
      father_name: input.father_name,
      father_date_of_birth: input.father_date_of_birth,
      father_phone: input.father_phone,
      father_email: input.father_email,
      father_afm: input.father_afm,
      mother_name: input.mother_name,
      mother_date_of_birth: input.mother_date_of_birth,
      mother_phone: input.mother_phone,
      mother_email: input.mother_email,
      mother_afm: input.mother_afm,
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
      address,
      school_name,
      auth_user_id,
      current_password,
      father_name,
      father_date_of_birth,
      father_phone,
      father_email,
      father_afm,
      mother_name,
      mother_date_of_birth,
      mother_phone,
      mother_email,
      mother_afm,
      created_at
    `)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update student");
  }

  return data;
}


export async function getStudentFullByIdAndSchoolId(
  supabase: any,
  studentId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      school_id,
      full_name,
      date_of_birth,
      phone,
      email,
      special_notes,
      level_id,
      address,
      school_name,
      auth_user_id,
      current_password,
      father_name,
      father_date_of_birth,
      father_phone,
      father_email,
      father_afm,
      mother_name,
      mother_date_of_birth,
      mother_phone,
      mother_email,
      mother_afm
    `)
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Student not found or not accessible");
  }

  return data;
}

export async function searchStudentsByName(
  supabase: any,
  schoolId: string,
  query: string
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, phone, email")
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .ilike("full_name", `%${query}%`)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function deleteStudentById(
  supabase: any,
  studentId: string
) {
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", studentId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}