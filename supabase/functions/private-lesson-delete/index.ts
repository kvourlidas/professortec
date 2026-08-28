/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ValidationError } from "../_shared/errors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();

    const program_item_id = body?.program_item_id?.trim?.();
    if (!program_item_id) throw new ValidationError("Missing program_item_id");

    const { data: target, error: targetErr } = await supabase
      .from("program_items").select("id, group_id, student_id")
      .eq("id", program_item_id).not("student_id", "is", null).maybeSingle();
    if (targetErr || !target) throw new AppError("Slot not found", 404, "NOT_FOUND");

    const { data: rows, error: rowsErr } = target.group_id
      ? await supabase.from("program_items").select("id, student_id").eq("group_id", target.group_id)
      : { data: [{ id: target.id, student_id: target.student_id }], error: null };
    if (rowsErr) throw new Error(rowsErr.message);
    const targetRows = (rows ?? []) as { id: string; student_id: string }[];

    const studentIds = Array.from(new Set(targetRows.map((r) => r.student_id)));
    const { data: foundStudents, error: stuErr } = await supabase
      .from("students").select("id").eq("school_id", schoolId).in("id", studentIds);
    if (stuErr) throw new Error(stuErr.message);
    if ((foundStudents ?? []).length !== studentIds.length) throw new AppError("Not authorized to delete this slot", 403, "FORBIDDEN");

    const ids = targetRows.map((r) => r.id);
    const { error: delErr } = await supabase.from("program_items").delete().in("id", ids);
    if (delErr) throw new Error(delErr.message);

    return ok({ deleted: ids });
  } catch (error) {
    return fail(error);
  }
});
