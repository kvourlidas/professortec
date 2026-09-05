// Shared header/column definitions for the students Excel template + importer,
// so the two always agree on column order and labels.

export type ImportColumnKey =
  | 'full_name' | 'level_name' | 'date_of_birth' | 'phone' | 'email'
  | 'address' | 'school_name' | 'special_notes' | 'password'
  | 'father_name' | 'father_date_of_birth' | 'father_phone' | 'father_email' | 'father_afm'
  | 'mother_name' | 'mother_date_of_birth' | 'mother_phone' | 'mother_email' | 'mother_afm';

export const IMPORT_COLUMNS: { key: ImportColumnKey; header: string }[] = [
  { key: 'full_name', header: 'Ονοματεπώνυμο' },
  { key: 'level_name', header: 'Επίπεδο' },
  { key: 'date_of_birth', header: 'Ημερομηνία Γέννησης' },
  { key: 'phone', header: 'Τηλέφωνο' },
  { key: 'email', header: 'Email' },
  { key: 'address', header: 'Διεύθυνση' },
  { key: 'school_name', header: 'Σχολείο' },
  { key: 'special_notes', header: 'Σημειώσεις' },
  { key: 'password', header: 'Κωδικός Πρόσβασης' },
  { key: 'father_name', header: 'Πατέρας Ονοματεπώνυμο' },
  { key: 'father_date_of_birth', header: 'Πατέρας Ημερομηνία Γέννησης' },
  { key: 'father_phone', header: 'Πατέρας Τηλέφωνο' },
  { key: 'father_email', header: 'Πατέρας Email' },
  { key: 'father_afm', header: 'Πατέρας ΑΦΜ' },
  { key: 'mother_name', header: 'Μητέρα Ονοματεπώνυμο' },
  { key: 'mother_date_of_birth', header: 'Μητέρα Ημερομηνία Γέννησης' },
  { key: 'mother_phone', header: 'Μητέρα Τηλέφωνο' },
  { key: 'mother_email', header: 'Μητέρα Email' },
  { key: 'mother_afm', header: 'Μητέρα ΑΦΜ' },
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

export async function downloadStudentImportTemplate() {
  const XLSX = await import('xlsx');

  const headers = IMPORT_COLUMNS.map((c) => c.header);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, Math.min(30, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Μαθητές');
  XLSX.writeFile(wb, timestampedFilename('protypo_eisagogis_mathiton', 'xlsx'));
}
