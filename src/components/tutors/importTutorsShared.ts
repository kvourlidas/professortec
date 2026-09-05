// Shared header/column definitions for the tutors Excel template + importer,
// so the two always agree on column order and labels.

export type ImportColumnKey =
  | 'full_name' | 'specialties' | 'date_of_birth' | 'hire_date'
  | 'afm' | 'phone' | 'email' | 'iban' | 'notes';

export const IMPORT_COLUMNS: { key: ImportColumnKey; header: string }[] = [
  { key: 'full_name', header: 'Ονοματεπώνυμο' },
  { key: 'specialties', header: 'Ειδικότητες' },
  { key: 'date_of_birth', header: 'Ημερομηνία Γέννησης' },
  { key: 'hire_date', header: 'Ημερομηνία Πρόσληψης' },
  { key: 'afm', header: 'ΑΦΜ' },
  { key: 'phone', header: 'Τηλέφωνο' },
  { key: 'email', header: 'Email' },
  { key: 'iban', header: 'IBAN' },
  { key: 'notes', header: 'Σημειώσεις' },
];

export function normalizeHeaderText(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\*/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

export async function downloadTutorImportTemplate() {
  const XLSX = await import('xlsx');

  const headers = IMPORT_COLUMNS.map((c) => c.header);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, Math.min(30, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Καθηγητές');
  XLSX.writeFile(wb, timestampedFilename('protypo_eisagogis_kathigiton', 'xlsx'));
}
