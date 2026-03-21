import { ValidationError } from "../errors.ts";
import type { UpdateLevelInput, DeleteLevelInput } from "../types/levels.ts";

export function validateCreateLevelBody(body: any) {
  const name = body?.name?.trim?.();

  if (!name) {
    throw new ValidationError("Missing name");
  }

  return { name };
}

export function validateUpdateLevelBody(body: any): UpdateLevelInput {
  const level_id = body?.level_id?.trim?.();
  const name = body?.name?.trim?.();

  if (!level_id) {
    throw new ValidationError("Missing level_id");
  }

  if (!name) {
    throw new ValidationError("Missing name");
  }

  return { level_id, name };
}

export function validateDeleteLevelBody(body: any): DeleteLevelInput {
  const level_id = body?.level_id?.trim?.();

  if (!level_id) {
    throw new ValidationError("Missing level_id");
  }

  return { level_id };
}
