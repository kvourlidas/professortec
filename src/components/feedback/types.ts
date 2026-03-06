export type StudentMiniRow = { id: string; full_name: string | null };

export type FeedbackRow = {
  student_id: string;
  rating: number | null;
  feedback: string | null;
  updated_at: string | null;
};

export type RowVM = {
  studentId: string;
  fullName: string;
  rating: number;
  feedback: string;
  updatedAt: string | null;
};
