/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { validateDeleteTutorPaymentBody } from "../_shared/validators/tutorsPaymentsValidators.ts";
import { deleteTutorPaymentService } from "../_shared/services/tutorsPaymentsService.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();
    const input = validateDeleteTutorPaymentBody(body);

    const result = await deleteTutorPaymentService(supabase, schoolId, input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
});