import {
  insertTutor,
  getTutorByIdAndSchoolId,
  searchTutorsByName,
  updateTutorById,
  deleteTutorById,
} from "../repositories/tutorsRepo.ts";
import { ValidationError } from "../errors.ts";
import type {
  CreateTutorInput,
  UpdateTutorInput,
  DeleteTutorInput,
} from "../types/tutors.ts";

export async function createTutorService(
  supabase: any,
  schoolId: string,
  input: CreateTutorInput
) {
  return await insertTutor(supabase, schoolId, input);
}

export async function updateTutorService(
  supabase: any,
  schoolId: string,
  input: UpdateTutorInput
) {
  await getTutorByIdAndSchoolId(supabase, input.tutor_id, schoolId);
  return await updateTutorById(supabase, input);
}

export type ResolveTutorResult =
  | { status: "resolved"; id: string; full_name: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; full_name: string; phone: string | null; email: string | null }[] };

/**
 * Resolves a tutor by id or by (partial) name — used by tools that need to
 * locate a tutor before handing off to a UI step (e.g. picking specialties).
 */
export async function resolveTutorByNameOrId(
  supabase: any,
  schoolId: string,
  params: { tutor_id?: string; tutor_name?: string }
): Promise<ResolveTutorResult> {
  if (params.tutor_id) {
    const tutor = await getTutorByIdAndSchoolId(supabase, params.tutor_id, schoolId);
    return { status: "resolved", id: tutor.id, full_name: tutor.full_name };
  }

  if (!params.tutor_name) {
    throw new ValidationError("Missing tutor_id or tutor_name");
  }
  const matches = await searchTutorsByName(supabase, schoolId, params.tutor_name);
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return { status: "resolved", id: matches[0].id, full_name: matches[0].full_name };
}

export async function deleteTutorService(
  supabase: any,
  schoolId: string,
  input: DeleteTutorInput
) {
  await getTutorByIdAndSchoolId(supabase, input.tutor_id, schoolId);
  await deleteTutorById(supabase, input.tutor_id);
  return { success: true };
}
