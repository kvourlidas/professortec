import { ValidationError } from "../errors.ts";
import type { UpdateTestInput, DeleteTestInput, StudentAssignmentInput } from "../types/tests.ts";

function parseStudentAssignments(body: any): StudentAssignmentInput[] | null {
  if (!Array.isArray(body?.student_assignments) || body.student_assignments.length === 0) return null;
  return body.student_assignments.map((a: any) => {
    const student_id = a?.student_id?.trim?.();
    const subject_id = a?.subject_id?.trim?.();
    if (!student_id) throw new ValidationError("Missing student_id in student_assignments");
    if (!subject_id) throw new ValidationError("Missing subject_id in student_assignments");
    return { student_id, subject_id };
  });
}

export function validateCreateTestBody(body: any) {
  const class_id = body?.class_id?.trim?.() || null;
  const level_id = body?.level_id?.trim?.() || null;
  const subject_id = body?.subject_id?.trim?.() || null;
  const test_date = body?.test_date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const title = body?.title?.trim?.() || null;
  const description = body?.description?.trim?.() || null;
  const student_assignments = parseStudentAssignments(body);

  if (!student_assignments && !class_id && !level_id) throw new ValidationError("Missing class_id");
  if (!test_date) throw new ValidationError("Missing test_date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { class_id, level_id, subject_id, test_date, start_time, end_time, title, description, student_assignments };
}

export function validateUpdateTestBody(body: any): UpdateTestInput {
  const test_id = body?.test_id?.trim?.();
  const class_id = body?.class_id?.trim?.() || null;
  const level_id = body?.level_id?.trim?.() || null;
  const subject_id = body?.subject_id?.trim?.() || null;
  const test_date = body?.test_date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const title = body?.title?.trim?.() || null;
  const active_during_holiday = typeof body?.active_during_holiday === "boolean" ? body.active_during_holiday : null;
  const student_assignments = parseStudentAssignments(body);

  if (!test_id) throw new ValidationError("Missing test_id");
  if (!test_date) throw new ValidationError("Missing test_date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { test_id, class_id, level_id, subject_id, test_date, start_time, end_time, title, active_during_holiday, student_assignments };
}

export function validateDeleteTestBody(body: any): DeleteTestInput {
  const test_id = body?.test_id?.trim?.();

  if (!test_id) throw new ValidationError("Missing test_id");

  return { test_id };
}
