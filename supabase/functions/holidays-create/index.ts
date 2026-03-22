/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { validateCreateHolidayBody } from "../_shared/validators/holidaysValidators.ts";
import { createHolidayService } from "../_shared/services/holidaysService.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();
    const input = validateCreateHolidayBody(body);

    const items = await createHolidayService(supabase, schoolId, input);

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
});