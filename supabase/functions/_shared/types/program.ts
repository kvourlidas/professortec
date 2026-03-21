export type CreateProgramInput = {
  program_id: string;
  class_id: string;
  subject_id: string | null;
  tutor_id: string | null;
  day_of_week: string;
  position: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
};

export type UpdateProgramInput = {
  program_item_id: string;
  class_id: string;
  subject_id: string | null;
  tutor_id: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
};

export type DeleteProgramInput = {
  program_item_id: string;
};
