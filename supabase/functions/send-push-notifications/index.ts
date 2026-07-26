/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ForbiddenError, ValidationError } from "../_shared/errors.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

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
    const { title, body: msgBody, kind = "general", data = {}, student_ids = [], class_ids = [] } = body;

    if (!title?.trim() || !msgBody?.trim()) {
      throw new ValidationError("title and body are required");
    }

    const db = createServiceClient();
    const isSendAll = student_ids.length === 0 && class_ids.length === 0;

    // Resolve student IDs when filtering by class
    let targetStudentIds: string[] = student_ids;
    if (!isSendAll && class_ids.length > 0 && student_ids.length === 0) {
      const { data: rows, error } = await db
        .from("class_students")
        .select("student_id")
        .in("class_id", class_ids);
      if (error) throw error;
      targetStudentIds = (rows ?? []).map((r: any) => r.student_id);
      if (targetStudentIds.length === 0) return ok({ stored: 0, pushed: 0 });
    }

    // Fetch target students with their push token
    let studentsQuery = db
      .from("students")
      .select("id, auth_user_id, expo_push_token")
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .not("auth_user_id", "is", null);

    if (!isSendAll) {
      studentsQuery = studentsQuery.in("id", targetStudentIds);
    }

    const { data: students, error: studentsErr } = await studentsQuery;
    if (studentsErr) throw studentsErr;
    if (!students || students.length === 0) return ok({ stored: 0, pushed: 0 });

    // Insert notification records into the DB
    const records = students.map((s: any) => ({
      recipient_user_id: s.auth_user_id,
      school_id: schoolId,
      title: title.trim(),
      body: msgBody.trim(),
      kind,
      data,
    }));

    const { error: insertErr } = await db.from("notifications").insert(records);
    if (insertErr) throw insertErr;

    // Send Expo push notifications (only to students with a valid token)
    const validTokens: string[] = students
      .map((s: any) => s.expo_push_token)
      .filter((t: unknown): t is string =>
        typeof t === "string" && t.startsWith("ExponentPushToken[")
      );

    let pushed = 0;
    for (let i = 0; i < validTokens.length; i += EXPO_BATCH_SIZE) {
      const batch = validTokens.slice(i, i + EXPO_BATCH_SIZE).map((to) => ({
        to,
        title: title.trim(),
        body: msgBody.trim(),
        data,
        sound: "default",
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (res.ok) {
        const result = await res.json();
        pushed += (result.data ?? []).filter((r: any) => r.status === "ok").length;
      }
    }

    return ok({ stored: students.length, pushed });
  } catch (error) {
    return fail(error);
  }
});
