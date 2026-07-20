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

    // Verify the slot belongs to a student in this school
    const { data: item, error: fetchErr } = await supabase
      .from("program_items")
      .select("id, student_id")
      .eq("id", program_item_id)
      .not("student_id", "is", null)
      .maybeSingle();

    if (fetchErr || !item) throw new AppError("Slot not found", 404, "NOT_FOUND");

    const { data: student, error: stuErr } = await supabase
      .from("students").select("id").eq("id", item.student_id).eq("school_id", schoolId).maybeSingle();
    if (stuErr || !student) throw new AppError("Not authorized to delete this slot", 403, "FORBIDDEN");

    const { error: delErr } = await supabase.from("program_items").delete().eq("id", program_item_id);
    if (delErr) throw new Error(delErr.message);

    return ok({ deleted: program_item_id });
  } catch (error) {
    return fail(error);
  }
});
