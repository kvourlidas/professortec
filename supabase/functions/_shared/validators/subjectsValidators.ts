import { ValidationError } from "../errors.ts";
import type { UpdateSubjectInput, DeleteSubjectInput } from "../types/subjects.ts";

export function validateCreateSubjectBody(body: any) {
  const name = body?.name?.trim?.();
  const level_id = body?.level_id?.trim?.();

  if (!name) {
    throw new ValidationError("Missing name");
  }

  if (!level_id) {
    throw new ValidationError("Missing level_id");
  }

  return { name, level_id };
}

export function validateUpdateSubjectBody(body: any): UpdateSubjectInput {
  const subject_id = body?.subject_id?.trim?.();
  const name = body?.name?.trim?.();
  const level_id = body?.level_id?.trim?.();

  if (!subject_id) {
    throw new ValidationError("Missing subject_id");
  }

  if (!name) {
    throw new ValidationError("Missing name");
  }

  if (!level_id) {
    throw new ValidationError("Missing level_id");
  }

  return { subject_id, name, level_id };
}

export function validateDeleteSubjectBody(body: any): DeleteSubjectInput {
  const subject_id = body?.subject_id?.trim?.();

  if (!subject_id) {
    throw new ValidationError("Missing subject_id");
  }

  return { subject_id };
}
