import type { CreateTutorInput, UpdateTutorInput } from "../types/tutors.ts";
import { NotFoundError } from "../errors.ts";

const TUTOR_SELECT = `
  id,
  school_id,
  full_name,
  date_of_birth,
  hire_date,
  afm,
  phone,
  email,
  iban,
  notes,
  created_at
`;

export async function insertTutor(
  supabase: any,
  schoolId: string,
  input: CreateTutorInput
) {
  const { data, error } = await supabase
    .from("tutors")
    .insert({
      school_id: schoolId,
      ...input,
    })
    .select(TUTOR_SELECT)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create tutor");
  }

  return data;
}

export async function getTutorByIdAndSchoolId(
  supabase: any,
  tutorId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("tutors")
    .select("id, school_id, full_name")
    .eq("id", tutorId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Tutor not found or not accessible");
  }

  return data;
}

export async function searchTutorsByName(
  supabase: any,
  schoolId: string,
  query: string
) {
  const { data, error } = await supabase
    .from("tutors")
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

export async function updateTutorById(
  supabase: any,
  input: UpdateTutorInput
) {
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.date_of_birth !== undefined) patch.date_of_birth = input.date_of_birth;
  if (input.hire_date !== undefined) patch.hire_date = input.hire_date;
  if (input.afm !== undefined) patch.afm = input.afm;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.iban !== undefined) patch.iban = input.iban;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await supabase
    .from("tutors")
    .update(patch)
    .eq("id", input.tutor_id)
    .select(TUTOR_SELECT)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update tutor");
  }

  return data;
}

export async function deleteTutorById(
  supabase: any,
  tutorId: string
) {
  const { error } = await supabase
    .from("tutors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tutorId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}