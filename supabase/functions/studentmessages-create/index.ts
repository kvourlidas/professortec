/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { validateCreateStudentMessageBody } from "../_shared/validators/studentMessagesValidators.ts";
import { createStudentMessageService } from "../_shared/services/studentMessagesService.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { supabase } = await requireSchoolContext(req);
    const body = await req.json();
    const input = validateCreateStudentMessageBody(body);

    const item = await createStudentMessageService(supabase, input);

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
});