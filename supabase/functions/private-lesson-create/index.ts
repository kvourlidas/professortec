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
    const uniqueStudentIds = new Set(roster.map((r) => r.student_id));
    if (uniqueStudentIds.size !== roster.length) throw new ValidationError("Duplicate student in students[]");

    // Verify every student belongs to this school
    const { data: foundStudents, error: stuErr } = await supabase
      .from("students").select("id").eq("school_id", schoolId).is("deleted_at", null).in("id", Array.from(uniqueStudentIds));
    if (stuErr) throw new Error(stuErr.message);
    if ((foundStudents ?? []).length !== uniqueStudentIds.size) throw new AppError("One or more students not found or not accessible", 403, "FORBIDDEN");

    // Find or create a default program for this school
    let programId: string;
    const { data: existingProgram } = await supabase
      .from("programs").select("id").eq("school_id", schoolId).limit(1).maybeSingle();

    if (existingProgram?.id) {
      programId = existingProgram.id;
    } else {
      const { data: newProgram, error: progErr } = await supabase
        .from("programs").insert({ school_id: schoolId, name: "Πρόγραμμα" }).select("id").maybeSingle();
      if (progErr || !newProgram) throw new Error("Failed to create program");
      programId = newProgram.id;
    }

    const group_id = roster.length > 1 ? crypto.randomUUID() : null;

    const rows = [];
    for (const r of roster) {
      const { data: posData } = await supabase
        .from("program_items").select("position").eq("student_id", r.student_id).order("position", { ascending: false }).limit(1).maybeSingle();
      const position = (posData?.position ?? 0) + 1;
      rows.push({
        program_id: programId, student_id: r.student_id, subject_id, group_id,
        day_of_week, position, start_time, end_time, start_date, end_date, room,
        charge_per_session: r.charge_per_session,
      });
    }

    const { data: items, error: insertErr } = await supabase
      .from("program_items")
      .insert(rows)
      .select("id, student_id, group_id, subject_id, day_of_week, start_time, end_time, start_date, end_date, room, position, charge_per_session");

    if (insertErr || !items) throw new Error(insertErr?.message ?? "Failed to create slot");

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
});
