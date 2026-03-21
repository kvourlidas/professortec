import { ValidationError } from "../errors.ts";
import type { UpdateTutorInput } from "../types/tutors.ts";
import type { DeleteTutorInput } from "../types/tutors.ts";

export function validateCreateTutorBody(body: any) {
  const full_name = body?.full_name?.trim?.();
  const date_of_birth = body?.date_of_birth ?? null;
  const afm = body?.afm?.trim?.() || null;
  const phone = body?.phone?.trim?.() || null;
  const email = body?.email?.trim?.() || null;

  if (!full_name) {
    throw new ValidationError("Missing full_name");
  }

  if (!email && !phone) {
    throw new ValidationError("Email or phone is required");
  }

  return {
    full_name,
    date_of_birth,
    afm,
    phone,
    email,
  };
}

export function validateUpdateTutorBody(body: any): UpdateTutorInput {
  const tutor_id = body?.tutor_id?.trim?.();

  if (!tutor_id) {
    throw new ValidationError("Missing tutor_id");
  }

  return {
    tutor_id,
    full_name: body?.full_name?.trim?.() || null,
    date_of_birth: body?.date_of_birth ?? null,
    afm: body?.afm?.trim?.() || null,
    phone: body?.phone?.trim?.() || null,
    email: body?.email?.trim?.() || null,
  };
}

export function validateDeleteTutorBody(body: any): DeleteTutorInput {
  const tutor_id = body?.tutor_id?.trim?.();

  if (!tutor_id) {
    throw new ValidationError("Missing tutor_id");
  }

  return { tutor_id };
}
