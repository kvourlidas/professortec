export type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
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

// A school year is never picked by hand any more — "current" is derived
// purely from today's date falling inside [start_date, end_date].
export function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSchoolYearCurrent(year: { start_date: string; end_date: string }, today: string = todayISODate()): boolean {
  return year.start_date <= today && today <= year.end_date;
}
