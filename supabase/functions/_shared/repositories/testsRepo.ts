import { NotFoundError } from "../errors.ts";
import type { CreateTestInput, UpdateTestInput, StudentAssignmentInput } from "../types/tests.ts";

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
      level_id: input.level_id,
      subject_id: input.subject_id,
      test_date: input.test_date,
      start_time: input.start_time,
      end_time: input.end_time,
      title: input.title,
      description: input.description,
    })
    .select("id, school_id, class_id, level_id, subject_id, test_date, start_time, end_time, title, description")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create test");
  }

  let testResults: any[] = [];
  if (input.student_assignments && input.student_assignments.length > 0) {
    const { data: resultsData, error: resultsErr } = await supabase
      .from("test_results")
      .insert(input.student_assignments.map((a) => ({
        test_id: data.id,
        student_id: a.student_id,
        subject_id: a.subject_id,
        grade: null,
      })))
      .select("id, test_id, student_id, subject_id, grade");
    if (resultsErr) throw new Error(resultsErr.message);
    testResults = resultsData ?? [];
  }

  return { ...data, test_results: testResults };
}

export async function replaceTestStudentAssignments(
  supabase: any,
  testId: string,
  assignments: StudentAssignmentInput[]
) {
  const { data: existing, error: existingErr } = await supabase
    .from("test_results")
    .select("id, student_id, subject_id, grade")
    .eq("test_id", testId);
  if (existingErr) throw new Error(existingErr.message);

  const existingByStudent = new Map<string, { id: string; student_id: string; subject_id: string | null; grade: number | null }>();
  (existing ?? []).forEach((r: any) => existingByStudent.set(r.student_id, r));

  const wantedStudentIds = new Set(assignments.map((a) => a.student_id));

  const toInsert = assignments.filter((a) => !existingByStudent.has(a.student_id));
  const toUpdate = assignments.filter((a) => {
    const ex = existingByStudent.get(a.student_id);
    return ex && ex.subject_id !== a.subject_id;
  });
  const toDeleteIds = (existing ?? [])
    .filter((r: any) => !wantedStudentIds.has(r.student_id))
    .map((r: any) => r.id);

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("test_results")
      .insert(toInsert.map((a) => ({ test_id: testId, student_id: a.student_id, subject_id: a.subject_id, grade: null })));
    if (insertErr) throw new Error(insertErr.message);
  }
  for (const a of toUpdate) {
    const ex = existingByStudent.get(a.student_id)!;
    const { error: updateErr } = await supabase
      .from("test_results")
      .update({ subject_id: a.subject_id })
      .eq("id", ex.id);
    if (updateErr) throw new Error(updateErr.message);
  }
  if (toDeleteIds.length > 0) {
    const { error: deleteErr } = await supabase.from("test_results").delete().in("id", toDeleteIds);
    if (deleteErr) throw new Error(deleteErr.message);
  }

  const { data: finalResults, error: finalErr } = await supabase
    .from("test_results")
    .select("id, test_id, student_id, subject_id, grade")
    .eq("test_id", testId);
  if (finalErr) throw new Error(finalErr.message);
  return finalResults ?? [];
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
    level_id: input.level_id,
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
    .select("id, school_id, class_id, level_id, subject_id, test_date, start_time, end_time, title, description, active_during_holiday")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update test");
  }

  let testResults: any[] | undefined;
  if (input.student_assignments) {
    testResults = await replaceTestStudentAssignments(supabase, input.test_id, input.student_assignments);
  }

  return { ...data, test_results: testResults };
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
