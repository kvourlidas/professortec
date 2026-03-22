import {
  insertTest,
  getTestByIdAndSchoolId,
  updateTestById,
  deleteTestById,
} from "../repositories/testsRepo.ts";
import type {
  CreateTestInput,
  UpdateTestInput,
  DeleteTestInput,
} from "../types/tests.ts";

export async function createTestService(
  supabase: any,
  schoolId: string,
  input: CreateTestInput
) {
  return await insertTest(supabase, schoolId, input);
}

export async function updateTestService(
  supabase: any,
  schoolId: string,
  input: UpdateTestInput
) {
  await getTestByIdAndSchoolId(supabase, input.test_id, schoolId);
  return await updateTestById(supabase, input);
}

export async function deleteTestService(
  supabase: any,
  schoolId: string,
  input: DeleteTestInput
) {
  await getTestByIdAndSchoolId(supabase, input.test_id, schoolId);
  await deleteTestById(supabase, input.test_id);
  return { success: true };
}
