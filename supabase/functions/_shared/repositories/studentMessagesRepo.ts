import type { CreateStudentMessageInput } from "../types/studentMessages.ts";

export async function insertStudentMessage(
  supabase: any,
  input: CreateStudentMessageInput
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      thread_id: input.thread_id,
      school_id: input.school_id,
      student_id: input.student_id,
      sender_role: "school",
      sender_user_id: input.sender_user_id,
      body: input.body,
    })
    .select("id, body, sender_role, created_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to send message");
  }

  return data;
}
