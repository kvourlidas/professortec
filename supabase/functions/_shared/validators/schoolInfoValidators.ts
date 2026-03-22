import { ValidationError } from "../errors.ts";
import type { UpdateSchoolInfoInput } from "../types/schoolInfo.ts";

export function validateUpdateSchoolInfoBody(body: any): UpdateSchoolInfoInput {
  const school_id = body?.school_id?.trim?.();
  if (!school_id) throw new ValidationError("Missing school_id");

  const name = body?.name?.trim?.();
  if (!name) throw new ValidationError("Το όνομα σχολείου είναι υποχρεωτικό.");

  return {
    school_id,
    name,
    address: body?.address?.trim?.() || null,
    phone: body?.phone?.trim?.() || null,
    email: body?.email?.trim?.() || null,
  };
}
