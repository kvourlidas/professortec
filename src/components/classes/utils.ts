export function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
