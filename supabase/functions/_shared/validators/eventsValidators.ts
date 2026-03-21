import { ValidationError } from "../errors.ts";
import type { UpdateEventInput, DeleteEventInput } from "../types/events.ts";

export function validateCreateEventBody(body: any) {
  const name = body?.name?.trim?.();
  const description = body?.description?.trim?.() || null;
  const date = body?.date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();

  if (!name) throw new ValidationError("Missing name");
  if (!date) throw new ValidationError("Missing date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { name, description, date, start_time, end_time };
}

export function validateUpdateEventBody(body: any): UpdateEventInput {
  const event_id = body?.event_id?.trim?.();
  const name = body?.name?.trim?.();
  const description = body?.description?.trim?.() || null;
  const date = body?.date?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();

  if (!event_id) throw new ValidationError("Missing event_id");
  if (!name) throw new ValidationError("Missing name");
  if (!date) throw new ValidationError("Missing date");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");

  return { event_id, name, description, date, start_time, end_time };
}

export function validateDeleteEventBody(body: any): DeleteEventInput {
  const event_id = body?.event_id?.trim?.();

  if (!event_id) throw new ValidationError("Missing event_id");

  return { event_id };
}
