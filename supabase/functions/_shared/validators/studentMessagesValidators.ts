import { ValidationError } from "../errors.ts";
import type { CreateStudentMessageInput } from "../types/studentMessages.ts";

export function validateCreateStudentMessageBody(body: any): CreateStudentMessageInput {
  const thread_id = body?.thread_id?.trim?.();
  const school_id = body?.school_id?.trim?.();
  const student_id = body?.student_id?.trim?.();
  const sender_user_id = body?.sender_user_id?.trim?.();
  const message_body = body?.body?.trim?.();

  if (!thread_id) throw new ValidationError("Missing thread_id");
  if (!school_id) throw new ValidationError("Missing school_id");
  if (!student_id) throw new ValidationError("Missing student_id");
  if (!sender_user_id) throw new ValidationError("Missing sender_user_id");
  if (!message_body) throw new ValidationError("Missing body");

  return {
    thread_id,
    school_id,
    student_id,
    sender_user_id,
    body: message_body,
  };
}
