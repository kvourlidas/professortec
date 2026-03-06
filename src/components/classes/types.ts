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

export type ModalMode = 'create' | 'edit';

export type ClassFormState = {
  title: string;
  levelId: string;
  subjectIds: string[];
};
