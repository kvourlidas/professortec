export type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

export type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  level_id: string | null;
};

export type LevelRow = {
  id: string;
  school_id: string;
  name: string;
};

export type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
};

export type ProgramRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
};

export type ProgramItemRow = {
  id: string;
  program_id: string;
  class_id: string;
  day_of_week: string;
  position: number | null;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

export type ClassSubjectRow = {
  class_id: string;
  subject_id: string;
};

export type SubjectTutorRow = {
  subject_id: string;
  tutor_id: string;
};

export type AddSlotForm = {
  classId: string | null;
  subjectId: string | null;
  tutorId: string | null;
  day: string;
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  startDate: string;
  endDate: string;
};

export type EditSlotForm = {
  id: string;
  classId: string | null;
  subjectId: string | null;
  tutorId: string | null;
  day: string;
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  startDate: string;
  endDate: string;
};

export type DeleteSlotTarget = {
  id: string;
  classLabel: string;
  dayLabel: string;
  timeRange: string;
};
