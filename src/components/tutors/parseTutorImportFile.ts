import { IMPORT_COLUMNS, normalizeHeaderText, type ImportColumnKey } from './importTutorsShared';

export type ParsedTutorRow = {
  rowNumber: number; // 1-based row number as it appears in the spreadsheet
  full_name: string;
  specialtyNames: string[];
  date_of_birth: string | null;
  hire_date: string | null;
  afm: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  notes: string | null;
  errors: string[];
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateCell(value: unknown, label: string, errors: string[]): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  const str = String(value).trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const day = Number(d), month = Number(m);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
  }

  errors.push(`${label}: μη έγκυρη ημερομηνία «${str}» (αναμένεται ΗΗ/ΜΜ/ΕΕΕΕ)`);
  return null;
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function splitSpecialties(value: string): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  value.split(/[,;|]/).forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  });
  return names;
}

export async function parseTutorImportFile(file: File): Promise<ParsedTutorRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = wb.SheetNames.find((n) => normalizeHeaderText(n) === normalizeHeaderText('Καθηγητές')) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
  if (raw.length === 0) return [];

  const headerRow = raw[0].map((h) => cellToText(h));
  const colIndexByKey = new Map<ImportColumnKey, number>();
  IMPORT_COLUMNS.forEach(({ key, header }) => {
    const idx = headerRow.findIndex((h) => normalizeHeaderText(h) === normalizeHeaderText(header));
    if (idx !== -1) colIndexByKey.set(key, idx);
  });

  const get = (row: unknown[], key: ImportColumnKey): string => {
    const idx = colIndexByKey.get(key);
    if (idx === undefined) return '';
    return cellToText(row[idx]);
  };

  const results: ParsedTutorRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

    const errors: string[] = [];

    const fullName = get(row, 'full_name');
    if (!fullName) errors.push('Λείπει το ονοματεπώνυμο');

    const phone = get(row, 'phone') || null;
    const email = get(row, 'email') || null;
    if (!phone && !email) errors.push('Χρειάζεται τηλέφωνο ή email');

    const dateOfBirthIdx = colIndexByKey.get('date_of_birth');
    const dateOfBirth = dateOfBirthIdx !== undefined ? parseDateCell(row[dateOfBirthIdx], 'Ημερομηνία Γέννησης', errors) : null;
    const hireDateIdx = colIndexByKey.get('hire_date');
    const hireDate = hireDateIdx !== undefined ? parseDateCell(row[hireDateIdx], 'Ημερομηνία Πρόσληψης', errors) : null;

    results.push({
      rowNumber: i + 1,
      full_name: fullName,
      specialtyNames: splitSpecialties(get(row, 'specialties')),
      date_of_birth: dateOfBirth,
      hire_date: hireDate,
      afm: get(row, 'afm') || null,
      phone,
      email,
      iban: get(row, 'iban') || null,
      notes: get(row, 'notes') || null,
      errors,
    });
  }

  return results;
}
