import {
  insertClass,
  getClassByIdAndSchoolId,
  searchClassesByTitle,
  updateClassById,
  deleteClassById,
} from "../repositories/classesRepo.ts";
import { ValidationError } from "../errors.ts";
import type {
  CreateClassInput,
  UpdateClassInput,
  DeleteClassInput,
} from "../types/classes.ts";

export async function createClassService(
  supabase: any,
  schoolId: string,
  input: Omit<CreateClassInput, "school_id">
) {
  return await insertClass(supabase, {
    ...input,
    school_id: schoolId,
  });
}

export async function updateClassService(
  supabase: any,
  schoolId: string,
  input: UpdateClassInput
) {
  await getClassByIdAndSchoolId(supabase, input.class_id, schoolId);
  return await updateClassById(supabase, input);
}

async function resolveClassId(
  supabase: any,
  schoolId: string,
  params: { class_id?: string; class_title?: string }
): Promise<
  | { status: "resolved"; id: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; title: string; subject: string | null }[] }
> {
  if (params.class_id) return { status: "resolved", id: params.class_id };

  if (!params.class_title) {
    throw new ValidationError("Missing class_id or class_title");
  }
  const matches = await searchClassesByTitle(supabase, schoolId, params.class_title);
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return { status: "resolved", id: matches[0].id };
}

export type UpdateClassByTitleResult =
  | { status: "updated"; item: unknown }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; title: string; subject: string | null }[] }
  | { status: "needs_subject_selection"; class_id: string; title: string };

/**
 * Resolves a class by id or by (partial) title, then either updates just the
 * title (subject unchanged) or — when change_subject is set — stops short of
 * writing and hands back the class id + merged title for the caller to
 * complete once a level/subject has been picked in the UI.
 */
export async function updateClassByTitleService(
  supabase: any,
  schoolId: string,
  params: { class_id?: string; class_title?: string; change_subject?: boolean; title?: string }
): Promise<UpdateClassByTitleResult> {
  const resolved = await resolveClassId(supabase, schoolId, params);
  if (resolved.status !== "resolved") return resolved;

  const current = await getClassByIdAndSchoolId(supabase, resolved.id, schoolId);
  const mergedTitle = params.title ?? current.title;

  if (params.change_subject) {
    return { status: "needs_subject_selection", class_id: resolved.id, title: mergedTitle };
  }

  const item = await updateClassById(supabase, {
    class_id: resolved.id,
    title: mergedTitle,
    subject: current.subject,
    subject_id: current.subject_id,
  });
  return { status: "updated", item };
}

export async function deleteClassService(
  supabase: any,
  schoolId: string,
  input: DeleteClassInput
) {
  await getClassByIdAndSchoolId(supabase, input.class_id, schoolId);
  await deleteClassById(supabase, input.class_id);
  return { success: true };
}

export type DeleteClassByTitleResult =
  | { status: "deleted"; class_id: string; title: string }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: { id: string; title: string; subject: string | null }[] };

/**
 * Resolves a class by id or by (partial) title, then deletes it.
 */
export async function deleteClassByTitleService(
  supabase: any,
  schoolId: string,
  params: { class_id?: string; class_title?: string }
): Promise<DeleteClassByTitleResult> {
  const resolved = await resolveClassId(supabase, schoolId, params);
  if (resolved.status !== "resolved") return resolved;

  const current = await getClassByIdAndSchoolId(supabase, resolved.id, schoolId);
  await deleteClassById(supabase, resolved.id);
  return { status: "deleted", class_id: resolved.id, title: current.title };
}