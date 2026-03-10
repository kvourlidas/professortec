import { NotFoundError } from "../errors.ts";
import type { CreateClassInput, UpdateClassInput } from "../types/classes.ts";

export async function insertClass(supabase: any, input: CreateClassInput) {
  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: input.school_id,
      title: input.title,
      subject: input.subject,
      subject_id: input.subject_id,
    })
    .select("id, school_id, title, subject, subject_id, tutor_id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create class");
  }

  return data;
}

export async function getClassById(supabase: any, classId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, school_id, title, subject, subject_id, tutor_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Class not found");
  }

  return data;
}

export async function getClassByIdAndSchoolId(
  supabase: any,
  classId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, school_id, title, subject, subject_id, tutor_id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Class not found or not accessible");
  }

  return data;
}

export async function updateClassById(supabase: any, input: UpdateClassInput) {
  const { data, error } = await supabase
    .from("classes")
    .update({
      title: input.title,
      subject: input.subject,
      subject_id: input.subject_id,
    })
    .eq("id", input.class_id)
    .select("id, school_id, title, subject, subject_id, tutor_id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update class");
  }

  return data;
}

export async function deleteClassById(supabase: any, classId: string) {
  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}