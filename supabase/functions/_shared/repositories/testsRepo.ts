import { NotFoundError } from "../errors.ts";
import type { CreateTestInput, UpdateTestInput } from "../types/tests.ts";

export async function insertTest(
  supabase: any,
  schoolId: string,
  input: CreateTestInput
) {
  const { data, error } = await supabase
    .from("tests")
    .insert({
      school_id: schoolId,
      class_id: input.class_id,
      subject_id: input.subject_id,
      test_date: input.test_date,
      start_time: input.start_time,
      end_time: input.end_time,
      title: input.title,
      description: input.description,
    })
    .select("id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create test");
  }

  return data;
}

export async function getTestByIdAndSchoolId(
  supabase: any,
  testId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, school_id")
    .eq("id", testId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Test not found or not accessible");
  }

  return data;
}

export async function updateTestById(
  supabase: any,
  input: UpdateTestInput
) {
  const updatePayload: Record<string, unknown> = {
    class_id: input.class_id,
    subject_id: input.subject_id,
    test_date: input.test_date,
    start_time: input.start_time,
    end_time: input.end_time,
    title: input.title,
  };
  if (input.active_during_holiday !== null) {
    updatePayload.active_during_holiday = input.active_during_holiday;
  }

  const { data, error } = await supabase
    .from("tests")
    .update(updatePayload)
    .eq("id", input.test_id)
    .select("id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description, active_during_holiday")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update test");
  }

  return data;
}

export async function deleteTestById(
  supabase: any,
  testId: string
) {
  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", testId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
