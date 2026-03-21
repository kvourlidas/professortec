import { NotFoundError } from "../errors.ts";
import type { CreateProgramInput, UpdateProgramInput } from "../types/program.ts";

export async function insertProgram(
  supabase: any,
  input: CreateProgramInput
) {
  const { data, error } = await supabase
    .from("program_items")
    .insert({
      program_id: input.program_id,
      class_id: input.class_id,
      subject_id: input.subject_id,
      tutor_id: input.tutor_id,
      day_of_week: input.day_of_week,
      position: input.position,
      start_time: input.start_time,
      end_time: input.end_time,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create program item");
  }

  return data;
}

export async function getProgramByIdAndSchoolId(
  supabase: any,
  programItemId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("program_items")
    .select("id, program_id, programs!inner(school_id)")
    .eq("id", programItemId)
    .eq("programs.school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Program item not found or not accessible");
  }

  return data;
}

export async function updateProgramById(
  supabase: any,
  input: UpdateProgramInput
) {
  const { data, error } = await supabase
    .from("program_items")
    .update({
      class_id: input.class_id,
      subject_id: input.subject_id,
      tutor_id: input.tutor_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .eq("id", input.program_item_id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update program item");
  }

  return data;
}

export async function deleteProgramById(
  supabase: any,
  programItemId: string
) {
  const { error } = await supabase
    .from("program_items")
    .delete()
    .eq("id", programItemId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
