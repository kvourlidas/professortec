export type StudentRow = {
  id: string;
  full_name: string | null;
  level_id: string | null;
};

export type SubjectRow = {
  id: string;
  name: string;
  level_id: string | null;
};

export type PrivateProgramItemRow = {
  id: string;
  program_id: string;
  group_id: string | null;
  student_id: string;
  subject_id: string | null;
  day_of_week: string;
  position: number | null;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  room: string | null;
  charge_per_session: number | null;
};

// One visual lesson card in the grid — one or more program_items rows sharing
// a group_id (or a single ungrouped row), since they were scheduled together
// at the same day/time and edited/deleted as a unit.
export type PrivateLessonGroup = {
  groupKey: string;
  items: PrivateProgramItemRow[];
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  subject_id: string | null;
};

export type RosterEntry = { studentId: string; charge: string };

export type AddSlotForm = {
  day: string;
  subjectId: string | null;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  roster: RosterEntry[];
};

export type EditSlotForm = {
  programItemId: string;
  day: string;
  subjectId: string | null;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  roster: RosterEntry[];
};

export type DeleteSlotTarget = {
  programItemId: string;
  label: string;
  dayLabel: string;
  timeRange: string;
};

export const emptyAddSlotForm: AddSlotForm = {
  day: '',
  subjectId: null,
  startTime: '',
  endTime: '',
  startDate: '',
  endDate: '',
  roster: [],
};
