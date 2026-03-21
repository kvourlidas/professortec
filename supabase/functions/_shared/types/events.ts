export type CreateEventInput = {
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
};

export type UpdateEventInput = {
  event_id: string;
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
};

export type DeleteEventInput = {
  event_id: string;
};
