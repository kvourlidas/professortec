export type CreateTutorInput = {
  full_name: string;
  date_of_birth: string | null;
  hire_date: string | null;
  afm: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
};

// Partial-update semantics: a field is only touched when the caller explicitly
// includes it, so a caller that only needs to change one field can't
// accidentally blank out the rest of the tutor's record.
export type UpdateTutorInput = {
  tutor_id: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  hire_date?: string | null;
  afm?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  notes?: string | null;
};

export type DeleteTutorInput = {
  tutor_id: string;
};