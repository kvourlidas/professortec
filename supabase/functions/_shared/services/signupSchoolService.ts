import { createSignupSchool } from "../repositories/signupSchoolRepo.ts";
import type { CreateSignupSchoolInput } from "../types/signupSchool.ts";

export async function createSignupSchoolService(
  serviceClient: any,
  userId: string,
  userEmail: string | null,
  input: CreateSignupSchoolInput
) {
  return await createSignupSchool(serviceClient, userId, userEmail, input);
}
