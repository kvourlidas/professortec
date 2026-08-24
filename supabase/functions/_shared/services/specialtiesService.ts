import {
  findSpecialtyByExactName,
  insertSpecialty,
  getSpecialtyByIdAndSchoolId,
  searchSpecialtiesByName,
  deleteSpecialtyById,
} from "../repositories/specialtiesRepo.ts";
import { ValidationError } from "../errors.ts";

export type CreateSpecialtyResult =
  | { status: "created"; item: unknown }
  | { status: "duplicate" };

export async function createSpecialtyService(
  supabase: any,
  schoolId: string,
  name: string
): Promise<CreateSpecialtyResult> {
  const existing = await findSpecialtyByExactName(supabase, schoolId, name);
  if (existing) return { status: "duplicate" };

  const item = await insertSpecialty(supabase, schoolId, { name });
  return { status: "created", item };
}

export type DeleteSpecialtyByNameResult =
  | { status: "deleted"; specialty_id: string; name: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; name: string }[] };

/**
 * Resolves a specialty by id or by (partial) name, then deletes it.
 */
export async function deleteSpecialtyByNameService(
  supabase: any,
  schoolId: string,
  params: { specialty_id?: string; specialty_name?: string }
): Promise<DeleteSpecialtyByNameResult> {
  let specialtyId = params.specialty_id;

  if (!specialtyId) {
    if (!params.specialty_name) {
      throw new ValidationError("Missing specialty_id or specialty_name");
    }
    const matches = await searchSpecialtiesByName(supabase, schoolId, params.specialty_name);
    if (matches.length === 0) return { status: "not_found" };
    if (matches.length > 1) return { status: "ambiguous", candidates: matches };
    specialtyId = matches[0].id;
  }

  const current = await getSpecialtyByIdAndSchoolId(supabase, specialtyId, schoolId);
  await deleteSpecialtyById(supabase, specialtyId);
  return { status: "deleted", specialty_id: specialtyId, name: current.name };
}
