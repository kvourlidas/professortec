import { ValidationError } from "../errors.ts";
import type { CreateSignupSchoolInput } from "../types/signupSchool.ts";

const VALID_ACCOUNT_TYPES = ["frontistirio", "idiaiterou"];

export function validateCreateSignupSchoolBody(body: any): CreateSignupSchoolInput {
  const name = body?.name?.trim?.();
  if (!name) throw new ValidationError("Το όνομα είναι υποχρεωτικό.");

  const account_type = body?.account_type?.trim?.() || null;
  if (account_type && !VALID_ACCOUNT_TYPES.includes(account_type)) {
    throw new ValidationError("Μη έγκυρος τύπος λογαριασμού.");
  }

  return {
    name,
    address: body?.address?.trim?.() || null,
    phone: body?.phone?.trim?.() || null,
    email: body?.email?.trim?.() || null,
    account_type: account_type as CreateSignupSchoolInput["account_type"],
    full_name: body?.full_name?.trim?.() || null,
  };
}
