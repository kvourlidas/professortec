import {
  insertSubject,
  getSubjectByIdAndSchoolId,
  searchSubjectsByName,
  updateSubjectById,
  deleteSubjectById,
} from "../repositories/subjectsRepo.ts";
import { ValidationError } from "../errors.ts";
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  DeleteSubjectInput,
} from "../types/subjects.ts";

export async function createSubjectService(
  supabase: any,
  schoolId: string,
  input: CreateSubjectInput
) {
  return await insertSubject(supabase, schoolId, input);
}

export async function updateSubjectService(
  supabase: any,
  schoolId: string,
  input: UpdateSubjectInput
) {
  await getSubjectByIdAndSchoolId(supabase, input.subject_id, schoolId);
  return await updateSubjectById(supabase, input);
}

export type SubjectCandidate = { id: string; name: string; level_id: string | null; level_name: string | null };

export type ResolveSubjectResult =
  | { status: "resolved"; id: string; name: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: SubjectCandidate[] };

/**
 * Resolves a subject by id or by (partial) name — used by tools that need to
 * locate a subject before handing off to a UI step (e.g. picking tutors).
 * When the same title exists under more than one level, pass level_name (if
 * the user mentioned it) to narrow the match down automatically instead of
 * surfacing an ambiguous result.
 */
export async function resolveSubjectByNameOrId(
  supabase: any,
  schoolId: string,
  params: { subject_id?: string; subject_name?: string; level_name?: string }
): Promise<ResolveSubjectResult> {
  if (params.subject_id) {
    const subject = await getSubjectByIdAndSchoolId(supabase, params.subject_id, schoolId);
    return { status: "resolved", id: subject.id, name: subject.name };
  }

  if (!params.subject_name) {
    throw new ValidationError("Missing subject_id or subject_name");
  }
  let matches = await searchSubjectsByName(supabase, schoolId, params.subject_name);
  if (matches.length === 0) return { status: "not_found" };

  if (matches.length > 1 && params.level_name) {
    const byLevel = matches.filter(
      (m) => m.level_name?.toLowerCase().includes(params.level_name!.toLowerCase())
    );
    if (byLevel.length > 0) matches = byLevel;
  }

  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return { status: "resolved", id: matches[0].id, name: matches[0].name };
}

export type UpdateSubjectByNameResult =
  | { status: "updated"; item: unknown }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: SubjectCandidate[] }
  | { status: "needs_level_selection"; subject_id: string; name: string };

/**
 * Resolves a subject by id or by (partial) name, then either updates just
 * the name (level unchanged) or — when change_level is set — stops short of
 * writing and hands back the subject id + merged name for the caller to
 * complete once a level has been picked in the UI.
 */
export async function updateSubjectByNameService(
  supabase: any,
  schoolId: string,
  params: { subject_id?: string; subject_name?: string; level_name?: string; change_level?: boolean; name?: string }
): Promise<UpdateSubjectByNameResult> {
  const resolved = await resolveSubjectByNameOrId(supabase, schoolId, {
    subject_id: params.subject_id,
    subject_name: params.subject_name,
    level_name: params.level_name,
  });
  if (resolved.status !== "resolved") return resolved;

  const current = await getSubjectByIdAndSchoolId(supabase, resolved.id, schoolId);
  const mergedName = params.name ?? current.name;

  if (params.change_level) {
    return { status: "needs_level_selection", subject_id: resolved.id, name: mergedName };
  }

  const item = await updateSubjectById(supabase, {
    subject_id: resolved.id,
    name: mergedName,
    level_id: current.level_id,
  });
  return { status: "updated", item };
}

export async function deleteSubjectService(
  supabase: any,
  schoolId: string,
  input: DeleteSubjectInput
) {
  await getSubjectByIdAndSchoolId(supabase, input.subject_id, schoolId);
  await deleteSubjectById(supabase, input.subject_id);
  return { success: true };
}
