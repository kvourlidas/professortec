export type CreateTestInput = {
  class_id: string;
  subject_id: string | null;
  test_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
};

export type UpdateTestInput = {
  test_id: string;
  class_id: string;
  subject_id: string | null;
  test_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
};

export type DeleteTestInput = {
  test_id: string;
};
