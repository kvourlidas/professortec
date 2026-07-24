export type StudentAssignmentInput = {
  student_id: string;
  subject_id: string;
};

export type CreateTestInput = {
  class_id: string | null;
  level_id: string | null;
  subject_id: string | null;
  test_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
  student_assignments: StudentAssignmentInput[] | null;
};

export type UpdateTestInput = {
  test_id: string;
  class_id: string | null;
  level_id: string | null;
  subject_id: string | null;
  test_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  active_during_holiday: boolean | null;
  student_assignments: StudentAssignmentInput[] | null;
};

export type DeleteTestInput = {
  test_id: string;
};
