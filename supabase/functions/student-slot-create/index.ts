/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ValidationError } from "../_shared/errors.ts";

const VALID_DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();

    const student_id = body?.student_id?.trim?.();
    if (!student_id) throw new ValidationError("Missing student_id");

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

    // Verify student belongs to this school
    const { data: student, error: stuErr } = await supabase
      .from("students").select("id").eq("id", student_id).eq("school_id", schoolId).maybeSingle();
    if (stuErr || !student) throw new AppError("Student not found or not accessible", 403, "FORBIDDEN");

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

    // Get next position for this student
    const { data: posData } = await supabase
      .from("program_items").select("position").eq("student_id", student_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = (posData?.position ?? 0) + 1;

    // Insert slot
    const { data: item, error: insertErr } = await supabase
      .from("program_items")
      .insert({ program_id: programId, student_id, subject_id, day_of_week, position, start_time, end_time, start_date, end_date })
      .select("id, student_id, subject_id, day_of_week, start_time, end_time, start_date, end_date, position")
      .maybeSingle();

    if (insertErr || !item) throw new Error(insertErr?.message ?? "Failed to create slot");

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
});
