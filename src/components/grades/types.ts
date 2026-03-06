export type StudentRow = {
  id: string;
  school_id: string;
  full_name: string;
  email: string | null;
};

export type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
  email: string | null;
};

export type StudentGradeRow = {
  id: string;
  student_id: string;
  test_id: string;
  test_name: string | null;
  test_date: string | null;
  start_time: string | null;
  end_time: string | null;
  class_title: string | null;
  subject_id: string | null;
  subject_name: string | null;
  grade: number | null;
  graded_at: string | null;
};

export type TutorGradeRow = {
  id: string;
  school_id: string;
  tutor_id: string;
  tutor_name: string | null;
  test_id: string;
  test_name: string | null;
  test_date: string | null;
  start_time: string | null;
  end_time: string | null;
  class_title: string | null;
  subject_id: string | null;
  subject_name: string | null;
  grade: number | null;
  students_count: number | null;
};

export type GradeRow = StudentGradeRow | TutorGradeRow;

export type GradesTab = 'overall' | 'by-subject';

export type SelectionType = 'student' | 'tutor' | null;
