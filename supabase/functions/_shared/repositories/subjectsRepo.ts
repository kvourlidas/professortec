import { NotFoundError } from "../errors.ts";
import type { CreateSubjectInput, UpdateSubjectInput } from "../types/subjects.ts";

export async function insertSubject(
  supabase: any,
  schoolId: string,
  input: CreateSubjectInput
) {
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      school_id: schoolId,
      name: input.name,
      level_id: input.level_id,
    })
    .select("id, school_id, name, level_id, created_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create subject");
  }

  return data;
}

export async function getSubjectByIdAndSchoolId(
  supabase: any,
  subjectId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, school_id, name, level_id")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Subject not found or not accessible");
  }

  return data;
}

export async function searchSubjectsByName(
  supabase: any,
  schoolId: string,
  query: string
) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, level_id, levels(name)")
    .eq("school_id", schoolId)
    .ilike("name", `%${query}%`)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    name: row.name as string,
    level_id: (row.level_id as string) ?? null,
    level_name: (row.levels?.name as string) ?? null,
  }));
}

export async function updateSubjectById(
  supabase: any,
  input: UpdateSubjectInput
) {
  const { data, error } = await supabase
    .from("subjects")
    .update({
      name: input.name,
      level_id: input.level_id,
    })
    .eq("id", input.subject_id)
    .select("id, school_id, name, level_id, created_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update subject");
  }

  return data;
}

export async function deleteSubjectById(
  supabase: any,
  subjectId: string
) {
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
