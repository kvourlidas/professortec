export type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
  date_of_birth: string | null;
  afm: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
  created_at: string;
};
export type ModalMode = 'create' | 'edit';
export type TutorFormState = {
  fullName: string;
  dateOfBirth: string;
  afm: string;
  phone: string;
  email: string;
  iban: string;
  notes: string;
};
export const emptyForm: TutorFormState = {
  fullName: '',
  dateOfBirth: '',
  afm: '',
  phone: '',
  email: '',
  iban: '',
  notes: '',
};
export const TUTOR_SELECT =
  'id, school_id, full_name, date_of_birth, afm, phone, email, iban, notes, created_at';