/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../_shared/errors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { schoolId, role } = await requireSchoolContext(req);

    if (!["super_admin", "school_owner", "teacher"].includes(role ?? "")) {
      throw new ForbiddenError("Not allowed");
    }

    const body = await req.json();
    const student_id = body?.student_id?.trim?.();
    const new_password = body?.new_password;

    if (!student_id) {
      throw new ValidationError("Missing student_id");
    }
    if (typeof new_password !== "string" || new_password.trim().length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    const db = createServiceClient();

    const { data: student, error: studentErr } = await db
      .from("students")
      .select("id, auth_user_id")
      .eq("id", student_id)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .maybeSingle();

    if (studentErr) throw new Error(studentErr.message);
    if (!student) throw new NotFoundError("Student not found or not accessible");
    if (!student.auth_user_id) {
      throw new ValidationError("Student has no login account yet");
    }

    const trimmedPassword = new_password.trim();

    const { error: updateErr } = await db.auth.admin.updateUserById(
      student.auth_user_id,
      { password: trimmedPassword }
    );

    if (updateErr) {
      throw new AppError(updateErr.message, 400, "PASSWORD_UPDATE_FAILED");
    }

    // Keep a plaintext copy so staff can read it back to a student who
    // forgets it. Auth still authenticates against the hashed password above;
    // this column is admin-convenience only.
    const { error: storeErr } = await db
      .from("students")
      .update({ current_password: trimmedPassword })
      .eq("id", student_id);
    if (storeErr) throw new Error(storeErr.message);

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
});
