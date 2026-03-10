/// <reference lib="deno.ns" />

import { createUserClient } from "./supabase.ts";
import { UnauthorizedError, ForbiddenError } from "./errors.ts";

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const supabase = createUserClient(authHeader);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  return { supabase, user };
}

export async function requireSchoolContext(req: Request) {
  const { supabase, user } = await requireAuth(req);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new ForbiddenError(error.message);
  }

  if (!profile) {
    throw new ForbiddenError("Profile not found");
  }

  if (!profile.school_id) {
    throw new ForbiddenError("User is not linked to a school");
  }

  return {
    supabase,
    user,
    profile,
    schoolId: profile.school_id as string,
    role: profile.role ?? null,
  };
}