export type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export type SchoolForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

export const emptyForm: SchoolForm = {
  name: '',
  address: '',
  phone: '',
  email: '',
};
