import { NotFoundError } from "../errors.ts";
import type { CreateSpecialtyInput } from "../types/specialties.ts";

export async function findSpecialtyByExactName(
  supabase: any,
  schoolId: string,
  name: string
) {
  const { data, error } = await supabase
    .from("specialties")
    .select("id, school_id, name")
    .eq("school_id", schoolId)
    .ilike("name", name)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function insertSpecialty(
  supabase: any,
  schoolId: string,
  input: CreateSpecialtyInput
) {
  const { data, error } = await supabase
    .from("specialties")
    .insert({ school_id: schoolId, name: input.name })
    .select("id, school_id, name")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create specialty");
  }

  return data;
}

export async function getSpecialtyByIdAndSchoolId(
  supabase: any,
  specialtyId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("specialties")
    .select("id, school_id, name")
    .eq("id", specialtyId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Specialty not found or not accessible");
  }

  return data;
}

export async function searchSpecialtiesByName(
  supabase: any,
  schoolId: string,
  query: string
) {
  const { data, error } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("school_id", schoolId)
    .ilike("name", `%${query}%`)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function deleteSpecialtyById(supabase: any, specialtyId: string) {
  const { error } = await supabase.from("specialties").delete().eq("id", specialtyId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
