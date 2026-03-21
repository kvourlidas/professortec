import { NotFoundError } from "../errors.ts";
import type { CreateLevelInput, UpdateLevelInput } from "../types/levels.ts";

export async function insertLevel(
  supabase: any,
  schoolId: string,
  input: CreateLevelInput
) {
  const { data, error } = await supabase
    .from("levels")
    .insert({
      school_id: schoolId,
      name: input.name,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create level");
  }

  return data;
}

export async function getLevelByIdAndSchoolId(
  supabase: any,
  levelId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("levels")
    .select("id, school_id")
    .eq("id", levelId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Level not found or not accessible");
  }

  return data;
}

export async function updateLevelById(
  supabase: any,
  input: UpdateLevelInput
) {
  const { data, error } = await supabase
    .from("levels")
    .update({ name: input.name })
    .eq("id", input.level_id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update level");
  }

  return data;
}

export async function deleteLevelById(
  supabase: any,
  levelId: string
) {
  const { error } = await supabase
    .from("levels")
    .delete()
    .eq("id", levelId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
