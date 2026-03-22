import { insertStudentMessage } from "../repositories/studentMessagesRepo.ts";
import type { CreateStudentMessageInput } from "../types/studentMessages.ts";

export async function createStudentMessageService(
  supabase: any,
  input: CreateStudentMessageInput
) {
  return await insertStudentMessage(supabase, input);
}
