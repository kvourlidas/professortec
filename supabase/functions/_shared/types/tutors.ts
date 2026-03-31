export type CreateTutorInput = {
  full_name: string;
  date_of_birth: string | null;
  afm: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
};

export type UpdateTutorInput = {
  tutor_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  afm: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
};

export type DeleteTutorInput = {
  tutor_id: string;
};