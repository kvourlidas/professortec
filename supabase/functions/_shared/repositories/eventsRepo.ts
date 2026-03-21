import { NotFoundError } from "../errors.ts";
import type { CreateEventInput, UpdateEventInput } from "../types/events.ts";

export async function insertEvent(
  supabase: any,
  schoolId: string,
  input: CreateEventInput
) {
  const { data, error } = await supabase
    .from("school_events")
    .insert({
      school_id: schoolId,
      name: input.name,
      description: input.description,
      date: input.date,
      start_time: input.start_time,
      end_time: input.end_time,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create event");
  }

  return data;
}

export async function getEventByIdAndSchoolId(
  supabase: any,
  eventId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("school_events")
    .select("id, school_id")
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NotFoundError("Event not found or not accessible");
  }

  return data;
}

export async function updateEventById(
  supabase: any,
  input: UpdateEventInput
) {
  const { data, error } = await supabase
    .from("school_events")
    .update({
      name: input.name,
      description: input.description,
      date: input.date,
      start_time: input.start_time,
      end_time: input.end_time,
    })
    .eq("id", input.event_id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update event");
  }

  return data;
}

export async function deleteEventById(
  supabase: any,
  eventId: string
) {
  const { error } = await supabase
    .from("school_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}