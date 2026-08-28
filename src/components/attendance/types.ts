export type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

export type ProgramItemRow = {
  id: string;
  class_id: string;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  subject_id: string | null;
  tutor_id: string | null;
  room: string | null;
};

export type ProgramItemOverrideRow = {
  id: string;
  program_item_id: string;
  override_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_deleted: boolean | null;
  is_inactive: boolean | null;
  holiday_active_override: boolean | null;
};

export type HolidayRow = { date: string };

// Only tests tied to a specific class are attendance-tracked — a level-wide
// or fully custom (idiaitera) test has no fixed class roster to record against.
export type TestRow = {
  id: string;
  class_id: string | null;
  subject_id: string | null;
  test_date: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  active_during_holiday: boolean;
};

export type SubjectRow = { id: string; name: string };
export type TutorRow = { id: string; full_name: string };
export type StudentRow = { id: string; full_name: string | null };

export type AttendanceStatus = 'present' | 'absent';

export type AttendanceRow = {
  id: string;
  school_id: string;
  class_id: string;
  program_item_id: string | null;
  student_id: string;
  session_date: string;
  status: AttendanceStatus;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

// One scheduled lesson occurrence on a given date, with its roster.
// A lesson and a test on the same class + date share a single session
// (and therefore a single set of attendance records) — isTest just flags
// that a test is attached, it never produces a duplicate card.
export type LessonSession = {
  key: string;
  classId: string;
  programItemId: string | null;
  testId: string | null;
  classTitle: string;
  subjectName: string;
  tutorName: string;
  timeRange: string;
  room: string | null;
  date: string;
  isTest: boolean;
  testTitle: string | null;
  roster: StudentRow[];
};

// ── Idiaitera (private lessons) — a slot already belongs to exactly one
// student, so there's no roster to mark: each session is that one student. ──

export type PrivateProgramItemRow = {
  id: string;
  student_id: string;
  subject_id: string | null;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  room: string | null;
};

export type PrivateAttendanceRow = {
  id: string;
  school_id: string;
  program_item_id: string;
  student_id: string;
  session_date: string;
  status: AttendanceStatus;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PrivateLessonSession = {
  key: string;
  programItemId: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  timeRange: string;
  room: string | null;
  date: string;
};
