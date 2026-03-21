export type CreateSubjectInput = {
  name: string;
  level_id: string;
};

export type UpdateSubjectInput = {
  subject_id: string;
  name: string;
  level_id: string;
};

export type DeleteSubjectInput = {
  subject_id: string;
};
