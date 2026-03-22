import { ForbiddenError } from "../errors.ts";
import type { UpdateSchoolInfoInput } from "../types/schoolInfo.ts";

export async function updateSchoolInfo(
  supabase: any,
  schoolId: string,
  input: UpdateSchoolInfoInput
) {
  // Ensure user can only update their own school
  if (input.school_id !== schoolId) {
    throw new ForbiddenError("Not authorized to update this school");
  }

  const { error } = await supabase
    .from("schools")
    .update({
      name: input.name,
      address: input.address,
      phone: input.phone,
      email: input.email,
    })
    .eq("id", schoolId);

  if (error) {
    throw new Error(error.message ?? "Failed to update school info");
  }

  return { success: true };
}
