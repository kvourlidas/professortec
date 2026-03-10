export type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

export type CreateClassInput = {
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
};

export type UpdateClassInput = {
  class_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
};

export type DeleteClassInput = {
  class_id: string;
};