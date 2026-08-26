import { ForbiddenError } from "../errors.ts";
import type { CreateSignupSchoolInput } from "../types/signupSchool.ts";

export async function createSignupSchool(
  serviceClient: any,
  userId: string,
  userEmail: string | null,
  input: CreateSignupSchoolInput
) {
  const { data: profile, error: profileErr } = await serviceClient
    .from("profiles")
    .select("id, school_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile) throw new ForbiddenError("Profile not found");

  if (profile.school_id) {
    return { school_id: profile.school_id as string };
  }

  const { data: school, error: schoolErr } = await serviceClient
    .from("schools")
    .insert({
      name: input.name,
      owner_id: userId,
      is_active: true,
      address: input.address,
      phone: input.phone,
      email: input.email ?? userEmail,
    })
    .select("id")
    .single();

  if (schoolErr) throw new Error(schoolErr.message);

  const profileUpdate: Record<string, unknown> = { school_id: school.id };
  if (input.account_type) profileUpdate.account_type = input.account_type;
  if (input.full_name) profileUpdate.full_name = input.full_name;

  const { error: updateErr } = await serviceClient
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (updateErr) throw new Error(updateErr.message);

  return { school_id: school.id as string };
}
