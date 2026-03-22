import { ValidationError } from "../errors.ts";
import type { UpdateTestInput, DeleteTestInput } from "../types/tests.ts";

export function validateCreateTestBody(body: any) {
  const class_id = body?.class_id?.trim?.();
  const subject_id = body?.subject_id?.trim?.() || null;
  const test_date = body?.test_date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const title = body?.title?.trim?.() || null;
  const description = body?.description?.trim?.() || null;

  if (!class_id) throw new ValidationError("Missing class_id");
  if (!test_date) throw new ValidationError("Missing test_date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { class_id, subject_id, test_date, start_time, end_time, title, description };
}

export function validateUpdateTestBody(body: any): UpdateTestInput {
  const test_id = body?.test_id?.trim?.();
  const class_id = body?.class_id?.trim?.();
  const subject_id = body?.subject_id?.trim?.() || null;
  const test_date = body?.test_date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const title = body?.title?.trim?.() || null;

  if (!test_id) throw new ValidationError("Missing test_id");
  if (!class_id) throw new ValidationError("Missing class_id");
  if (!test_date) throw new ValidationError("Missing test_date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { test_id, class_id, subject_id, test_date, start_time, end_time, title };
}

export function validateDeleteTestBody(body: any): DeleteTestInput {
  const test_id = body?.test_id?.trim?.();

  if (!test_id) throw new ValidationError("Missing test_id");

  return { test_id };
}
