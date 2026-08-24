import { ValidationError } from "../errors.ts";
import type { UpdateTutorInput } from "../types/tutors.ts";
import type { DeleteTutorInput } from "../types/tutors.ts";

export function validateCreateTutorBody(body: any) {
  const full_name = body?.full_name?.trim?.();
  const date_of_birth = body?.date_of_birth ?? null;
  const afm = body?.afm?.trim?.() || null;
  const phone = body?.phone?.trim?.() || null;
  const email = body?.email?.trim?.() || null;
  const iban = body?.iban?.trim?.() || null;
  const notes = body?.notes?.trim?.() || null;

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
    iban,
    notes,
  };
}

export function validateUpdateTutorBody(body: any): UpdateTutorInput {
  const tutor_id = body?.tutor_id?.trim?.();

  if (!tutor_id) {
    throw new ValidationError("Missing tutor_id");
  }

  const result: UpdateTutorInput = { tutor_id };
  if (body?.full_name !== undefined) result.full_name = body.full_name?.trim?.() || null;
  if (body?.date_of_birth !== undefined) result.date_of_birth = body.date_of_birth ?? null;
  if (body?.afm !== undefined) result.afm = body.afm?.trim?.() || null;
  if (body?.phone !== undefined) result.phone = body.phone?.trim?.() || null;
  if (body?.email !== undefined) result.email = body.email?.trim?.() || null;
  if (body?.iban !== undefined) result.iban = body.iban?.trim?.() || null;
  if (body?.notes !== undefined) result.notes = body.notes?.trim?.() || null;

  return result;
}

export function validateDeleteTutorBody(body: any): DeleteTutorInput {
  const tutor_id = body?.tutor_id?.trim?.();

  if (!tutor_id) {
    throw new ValidationError("Missing tutor_id");
  }

  return { tutor_id };
}