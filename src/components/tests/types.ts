export type ClassRow = { id: string; school_id: string; title: string; subject_id: string | null };
export type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null };
export type LevelRow = { id: string; school_id: string; name: string };
export type ClassSubjectRow = { class_id: string; subject_id: string; school_id?: string | null };
export type TestRow = {
  id: string; school_id: string; class_id: string | null; level_id: string | null; subject_id: string | null;
  test_date: string; start_time: string | null; end_time: string | null;
  title: string | null; description: string | null;
};
export type StudentAssignment = { studentId: string; subjectId: string | null; chargeAmount?: string };
export type AddTestForm = {
  classId: string | null; classIds: string[]; levelId: string | null; subjectId: string | null; date: string;
  startTime: string; endTime: string; title: string; studentAssignments: StudentAssignment[];
};
export type EditTestForm = AddTestForm & { id: string };
export type StudentRow = { id: string; school_id: string; full_name: string | null };
export type TestResultRow = { id: string; test_id: string; student_id: string; subject_id?: string | null; grade: number | null };
export type TestResultsModalState = {
  testId: string; testTitle: string | null; dateDisplay: string;
  timeRange: string; classTitle: string; subjectName: string;
};
export type GradeInfo = { grade: string; existingResultId?: string; subjectId?: string | null };
export type DeleteTarget = {
  id: string; dateDisplay: string; timeRange: string; classTitle: string; subjectName: string;
};

export const emptyForm: AddTestForm = {
  classId: null, classIds: [], levelId: null, subjectId: null, date: '', startTime: '', endTime: '', title: '', studentAssignments: [],
};
