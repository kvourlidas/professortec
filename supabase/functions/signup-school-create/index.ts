/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";
import { validateCreateSignupSchoolBody } from "../_shared/validators/signupSchoolValidators.ts";
import { createSignupSchoolService } from "../_shared/services/signupSchoolService.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { user } = await requireAuth(req);
    const body = await req.json();
    const input = validateCreateSignupSchoolBody(body);

    const serviceClient = createServiceClient();
    const result = await createSignupSchoolService(serviceClient, user.id, user.email ?? null, input);

    return ok(result);
  } catch (error) {
    return fail(error);
  }
});
