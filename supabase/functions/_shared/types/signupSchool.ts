export type CreateSignupSchoolInput = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  account_type: "frontistirio" | "idiaiterou" | null;
  full_name: string | null;
};
