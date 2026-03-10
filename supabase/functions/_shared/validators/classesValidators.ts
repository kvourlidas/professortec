import { ValidationError } from "../errors.ts";
import type {
  UpdateClassInput,
  DeleteClassInput,
} from "../types/classes.ts";

export function validateCreateClassBody(body: any) {
  const title = body?.title?.trim?.();
  const subject = body?.subject ?? null;
  const subject_id = body?.subject_id ?? null;

  if (!title) {
    throw new ValidationError("Missing title");
  }

  return {
    title,
    subject,
    subject_id,
  };
}

export function validateUpdateClassBody(body: any): UpdateClassInput {
  const class_id = body?.class_id?.trim?.();
  const title = body?.title?.trim?.();
  const subject = body?.subject ?? null;
  const subject_id = body?.subject_id ?? null;

  if (!class_id) {
    throw new ValidationError("Missing class_id");
  }

  if (!title) {
    throw new ValidationError("Missing title");
  }

  return {
    class_id,
    title,
    subject,
    subject_id,
  };
}

export function validateDeleteClassBody(body: any): DeleteClassInput {
  const class_id = body?.class_id?.trim?.();

  if (!class_id) {
    throw new ValidationError("Missing class_id");
  }

  return { class_id };
}