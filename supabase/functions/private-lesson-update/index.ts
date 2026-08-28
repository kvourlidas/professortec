/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ValidationError } from "../_shared/errors.ts";

const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function parseCharge(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (isNaN(n) || n < 0) throw new ValidationError("Invalid charge_per_session");
  return n;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();

    const program_item_id = body?.program_item_id?.trim?.();
    if (!program_item_id) throw new ValidationError("Missing program_item_id");

    const students = Array.isArray(body?.students) ? body.students : [];
    if (students.length === 0) throw new ValidationError("Missing students");

    const subject_id = body?.subject_id?.trim?.() || null;
    const day_of_week = body?.day_of_week?.trim?.();
    if (!day_of_week || !VALID_DAYS.includes(day_of_week)) throw new ValidationError("Invalid day_of_week");

    const start_time = body?.start_time?.trim?.();
    if (!start_time) throw new ValidationError("Missing start_time");
    const end_time = body?.end_time?.trim?.();
    if (!end_time) throw new ValidationError("Missing end_time");
    const start_date = body?.start_date?.trim?.();
    if (!start_date) throw new ValidationError("Missing start_date");
    const end_date = body?.end_date?.trim?.();
    if (!end_date) throw new ValidationError("Missing end_date");
    const room = body?.room?.trim?.() || null;

    const roster = students.map((s: Record<string, unknown>) => {
      const student_id = (s?.student_id as string | undefined)?.trim?.();
      if (!student_id) throw new ValidationError("Missing student_id in students[]");
      return { student_id, charge_per_session: parseCharge(s?.charge_per_session) };
    });
    const rosterIds = new Set(roster.map((r) => r.student_id));
    if (rosterIds.size !== roster.length) throw new ValidationError("Duplicate student in students[]");

    // Load the target row and every sibling row that shares its lesson (group_id), scoped to this school's students.
    const { data: target, error: targetErr } = await supabase
      .from("program_items").select("id, group_id, student_id")
      .eq("id", program_item_id).not("student_id", "is", null).maybeSingle();
    if (targetErr || !target) throw new AppError("Slot not found", 404, "NOT_FOUND");

    const { data: siblingRows, error: siblingErr } = target.group_id
      ? await supabase.from("program_items").select("id, student_id").eq("group_id", target.group_id)
      : { data: [{ id: target.id, student_id: target.student_id }], error: null };
    if (siblingErr) throw new Error(siblingErr.message);
    const existingRows = (siblingRows ?? []) as { id: string; student_id: string }[];

    // Ownership check — every existing row's student, and every incoming roster student, must belong to this school.
    const allStudentIds = new Set<string>([...existingRows.map((r) => r.student_id), ...rosterIds]);
    const { data: foundStudents, error: stuErr } = await supabase
      .from("students").select("id").eq("school_id", schoolId).is("deleted_at", null).in("id", Array.from(allStudentIds));
    if (stuErr) throw new Error(stuErr.message);
    if ((foundStudents ?? []).length !== allStudentIds.size) throw new AppError("Not authorized to edit this slot", 403, "FORBIDDEN");

    const existingByStudent = new Map(existingRows.map((r) => [r.student_id, r.id]));
    const toRemove = existingRows.filter((r) => !rosterIds.has(r.student_id)).map((r) => r.id);
    const toUpdate = roster.filter((r) => existingByStudent.has(r.student_id));
    const toAdd = roster.filter((r) => !existingByStudent.has(r.student_id));

    // Growing beyond one student needs a shared group_id; a lone remaining student loses it.
    const finalCount = toUpdate.length + toAdd.length;
    const group_id = finalCount > 1 ? (target.group_id ?? crypto.randomUUID()) : null;

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase.from("program_items").delete().in("id", toRemove);
      if (delErr) throw new Error(delErr.message);
    }

    for (const r of toUpdate) {
      const id = existingByStudent.get(r.student_id)!;
      const { error: updErr } = await supabase.from("program_items").update({
        subject_id, day_of_week, start_time, end_time, start_date, end_date, room, group_id,
        charge_per_session: r.charge_per_session,
      }).eq("id", id);
      if (updErr) throw new Error(updErr.message);
    }

    if (toAdd.length > 0) {
      const { data: programRow } = await supabase.from("program_items").select("program_id").eq("id", program_item_id).maybeSingle();
      const programId = programRow?.program_id;
      for (const r of toAdd) {
        const { data: posData } = await supabase
          .from("program_items").select("position").eq("student_id", r.student_id).order("position", { ascending: false }).limit(1).maybeSingle();
        const position = (posData?.position ?? 0) + 1;
        const { error: insErr } = await supabase.from("program_items").insert({
          program_id: programId, student_id: r.student_id, subject_id, group_id, day_of_week, position,
          start_time, end_time, start_date, end_date, room, charge_per_session: r.charge_per_session,
        });
        if (insErr) throw new Error(insErr.message);
      }
    }

    const { data: items, error: fetchErr } = await supabase
      .from("program_items")
      .select("id, student_id, group_id, subject_id, day_of_week, start_time, end_time, start_date, end_date, room, position, charge_per_session")
      .eq(group_id ? "group_id" : "id", group_id ?? program_item_id);
    if (fetchErr) throw new Error(fetchErr.message);

    return ok({ items: items ?? [] });
  } catch (error) {
    return fail(error);
  }
});
