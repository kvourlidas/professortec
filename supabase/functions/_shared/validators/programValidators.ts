import { ValidationError } from "../errors.ts";
import type { UpdateProgramInput, DeleteProgramInput } from "../types/program.ts";

export function validateCreateProgramBody(body: any) {
  const program_id = body?.program_id?.trim?.();
  const class_id = body?.class_id?.trim?.();
  const subject_id = body?.subject_id?.trim?.() || null;
  const tutor_id = body?.tutor_id?.trim?.() || null;
  const day_of_week = body?.day_of_week?.trim?.();
  const position = typeof body?.position === "number" ? body.position : null;
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const start_date = body?.start_date?.trim?.();
  const end_date = body?.end_date?.trim?.();

  if (!program_id) throw new ValidationError("Missing program_id");
  if (!class_id) throw new ValidationError("Missing class_id");
  if (!day_of_week) throw new ValidationError("Missing day_of_week");
  if (position === null) throw new ValidationError("Missing position");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");
  if (!start_date) throw new ValidationError("Missing start_date");
  if (!end_date) throw new ValidationError("Missing end_date");

  return {
    program_id,
    class_id,
    subject_id,
    tutor_id,
    day_of_week,
    position,
    start_time,
    end_time,
    start_date,
    end_date,
  };
}

export function validateUpdateProgramBody(body: any): UpdateProgramInput {
  const program_item_id = body?.program_item_id?.trim?.();
  const class_id = body?.class_id?.trim?.();
  const subject_id = body?.subject_id?.trim?.() || null;
  const tutor_id = body?.tutor_id?.trim?.() || null;
  const day_of_week = body?.day_of_week?.trim?.();
  const start_time = body?.start_time?.trim?.();
  const end_time = body?.end_time?.trim?.();
  const start_date = body?.start_date?.trim?.();
  const end_date = body?.end_date?.trim?.();

  if (!program_item_id) throw new ValidationError("Missing program_item_id");
  if (!class_id) throw new ValidationError("Missing class_id");
  if (!day_of_week) throw new ValidationError("Missing day_of_week");
  if (!start_time) throw new ValidationError("Missing start_time");
  if (!end_time) throw new ValidationError("Missing end_time");
  if (!start_date) throw new ValidationError("Missing start_date");
  if (!end_date) throw new ValidationError("Missing end_date");

  return {
    program_item_id,
    class_id,
    subject_id,
    tutor_id,
    day_of_week,
    start_time,
    end_time,
    start_date,
    end_date,
  };
}

export function validateDeleteProgramBody(body: any): DeleteProgramInput {
  const program_item_id = body?.program_item_id?.trim?.();

  if (!program_item_id) throw new ValidationError("Missing program_item_id");

  return { program_item_id };
}
