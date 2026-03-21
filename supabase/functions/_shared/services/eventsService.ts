import {
  insertEvent,
  getEventByIdAndSchoolId,
  updateEventById,
  deleteEventById,
} from "../repositories/eventsRepo.ts";
import type {
  CreateEventInput,
  UpdateEventInput,
  DeleteEventInput,
} from "../types/events.ts";

export async function createEventService(
  supabase: any,
  schoolId: string,
  input: CreateEventInput
) {
  return await insertEvent(supabase, schoolId, input);
}

export async function updateEventService(
  supabase: any,
  schoolId: string,
  input: UpdateEventInput
) {
  await getEventByIdAndSchoolId(supabase, input.event_id, schoolId);
  return await updateEventById(supabase, input);
}

export async function deleteEventService(
  supabase: any,
  schoolId: string,
  input: DeleteEventInput
) {
  await getEventByIdAndSchoolId(supabase, input.event_id, schoolId);
  await deleteEventById(supabase, input.event_id);
  return { success: true };
}
