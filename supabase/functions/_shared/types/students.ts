export type CreateStudentInput = {
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  special_notes: string | null;
  level_id: string | null;
  father_name: string | null;
  father_date_of_birth: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_date_of_birth: string | null;
  mother_phone: string | null;
  mother_email: string | null;
};

export type UpdateStudentInput = {
  student_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  special_notes: string | null;
  level_id: string | null;
  father_name: string | null;
  father_date_of_birth: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_date_of_birth: string | null;
  mother_phone: string | null;
  mother_email: string | null;
};


export type DeleteStudentInput = {
  student_id: string;
};