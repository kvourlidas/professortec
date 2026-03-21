import type { CreateTutorInput, UpdateTutorInput } from "../types/tutors.ts";
import { NotFoundError } from "../errors.ts";

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
    .select(`
      id,
      school_id,
      full_name,
      date_of_birth,
      afm,
      phone,
      email,
      created_at
    `)
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
    .select("id, school_id")
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

export async function updateTutorById(
  supabase: any,
  input: UpdateTutorInput
) {
  const { data, error } = await supabase
    .from("tutors")
    .update({
      full_name: input.full_name,
      date_of_birth: input.date_of_birth,
      afm: input.afm,
      phone: input.phone,
      email: input.email,
    })
    .eq("id", input.tutor_id)
    .select(`
      id,
      school_id,
      full_name,
      date_of_birth,
      afm,
      phone,
      email,
      created_at
    `)
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
    .delete()
    .eq("id", tutorId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}