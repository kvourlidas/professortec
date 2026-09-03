import { ValidationError } from "../errors.ts";
import type { UpdateStudentInput } from "../types/students.ts";
import type { DeleteStudentInput } from "../types/students.ts";

function validateAfm(value: string | null, label: string): string | null {
  if (!value) return null;
  if (!/^\d{9}$/.test(value)) {
    throw new ValidationError(`${label} must be a 9-digit number`);
  }
  return value;
}

export function validateCreateStudentBody(body: any) {
  const full_name = body?.full_name?.trim?.();
  const date_of_birth = body?.date_of_birth ?? null;
  const phone = body?.phone?.trim?.() || null;
  const email = body?.email?.trim?.() || null;
  const special_notes = body?.special_notes?.trim?.() || null;
  const level_id = body?.level_id?.trim?.() || null;
  const address = body?.address?.trim?.() || null;
  const school_name = body?.school_name?.trim?.() || null;

  const father_name = body?.father_name?.trim?.() || null;
  const father_date_of_birth = body?.father_date_of_birth ?? null;
  const father_phone = body?.father_phone?.trim?.() || null;
  const father_email = body?.father_email?.trim?.() || null;
  const father_afm = validateAfm(body?.father_afm?.trim?.() || null, "father_afm");

  const mother_name = body?.mother_name?.trim?.() || null;
  const mother_date_of_birth = body?.mother_date_of_birth ?? null;
  const mother_phone = body?.mother_phone?.trim?.() || null;
  const mother_email = body?.mother_email?.trim?.() || null;
  const mother_afm = validateAfm(body?.mother_afm?.trim?.() || null, "mother_afm");

  if (!full_name) {
    throw new ValidationError("Missing full_name");
  }

  if (!email && !phone) {
    throw new ValidationError("Email or phone is required");
  }

  return {
    full_name,
    date_of_birth,
    phone,
    email,
    special_notes,
    level_id,
    address,
    school_name,
    father_name,
    father_date_of_birth,
    father_phone,
    father_email,
    father_afm,
    mother_name,
    mother_date_of_birth,
    mother_phone,
    mother_email,
    mother_afm,
  };
}

export function validateUpdateStudentBody(body: any): UpdateStudentInput {
  const student_id = body?.student_id?.trim?.();

  if (!student_id) {
    throw new ValidationError("Missing student_id");
  }

  return {
    student_id,
    full_name: body?.full_name?.trim?.() || null,
    date_of_birth: body?.date_of_birth ?? null,
    phone: body?.phone?.trim?.() || null,
    email: body?.email?.trim?.() || null,
    special_notes: body?.special_notes?.trim?.() || null,
    level_id: body?.level_id?.trim?.() || null,
    address: body?.address?.trim?.() || null,
    school_name: body?.school_name?.trim?.() || null,
    father_name: body?.father_name?.trim?.() || null,
    father_date_of_birth: body?.father_date_of_birth ?? null,
    father_phone: body?.father_phone?.trim?.() || null,
    father_email: body?.father_email?.trim?.() || null,
    father_afm: validateAfm(body?.father_afm?.trim?.() || null, "father_afm"),
    mother_name: body?.mother_name?.trim?.() || null,
    mother_date_of_birth: body?.mother_date_of_birth ?? null,
    mother_phone: body?.mother_phone?.trim?.() || null,
    mother_email: body?.mother_email?.trim?.() || null,
    mother_afm: validateAfm(body?.mother_afm?.trim?.() || null, "mother_afm"),
  };
}


export function validateDeleteStudentBody(body: any): DeleteStudentInput {
  const student_id = body?.student_id?.trim?.();

  if (!student_id) {
    throw new ValidationError("Missing student_id");
  }

  return { student_id };
}