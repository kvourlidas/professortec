export type StudentRow = {
  id: string;
  school_id: string;
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
  created_at: string;
};

export type LevelRow = { id: string; school_id: string; name: string; created_at: string };

export type SubscriptionRow = {
  id: string;
  school_id: string;
  student_id: string;
  package_id: string | null;
  package_name: string;
  price: number;
  currency: string;
  status: 'active' | 'completed' | 'canceled';
  starts_on: string | null;
  ends_on: string | null;
  created_at: string | null;
  balance?: number | null;
  paid_amount?: number | null;
  charge_amount?: number | null;
};

export type ClassEnrollment = {
  class_id: string;
  classes: { id: string; title: string; subject: string | null } | null;
};

export type ProgramSlot = {
  id: string;
  class_id: string;
  class_title: string;
  class_subject: string | null;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
};

export const STUDENT_SELECT = `
  id, school_id, full_name, date_of_birth, phone, email, special_notes, level_id,
  father_name, father_date_of_birth, father_phone, father_email,
  mother_name, mother_date_of_birth, mother_phone, mother_email,
  created_at
`;

export function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

export function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
