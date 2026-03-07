export const pad2 = (n: number) => n.toString().padStart(2, '0');

export const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

export const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d); copy.setDate(copy.getDate() + days); return copy;
};

export const parseYMD = (s: string): Date => new Date(s + 'T00:00:00');

export const formatDisplay = (iso: string): string => {
  const [y, m, d] = iso.split('-'); if (!y || !m || !d) return iso; return `${d}/${m}/${y}`;
};

export const formatDateDisplayFromDate = (d: Date | null): string => {
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const parseDisplayToDate = (display: string): Date | null => {
  if (!display) return null;
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};
