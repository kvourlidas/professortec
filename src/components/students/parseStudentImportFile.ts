import type { LevelRow } from './types';
import { normalizeText } from './types';
import { IMPORT_COLUMNS, normalizeHeaderText, type ImportColumnKey } from './importStudentsShared';

export type ParsedStudentRow = {
  rowNumber: number; // 1-based row number as it appears in the spreadsheet
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  school_name: string | null;
  special_notes: string | null;
  password: string | null;
  level_id: string | null;
  father_name: string | null;
  father_date_of_birth: string | null;
  father_phone: string | null;
  father_email: string | null;
  father_afm: string | null;
  mother_name: string | null;
  mother_date_of_birth: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  mother_afm: string | null;
  errors: string[];
  warnings: string[];
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

function validateAfm(value: string, label: string, errors: string[]): string | null {
  if (!value) return null;
  const digitsOnly = value.replace(/\D/g, '');
  if (!/^\d{9}$/.test(digitsOnly)) {
    errors.push(`${label}: το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία («${value}»)`);
    return null;
  }
  return digitsOnly;
}

export async function parseStudentImportFile(file: File, levels: LevelRow[]): Promise<ParsedStudentRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = wb.SheetNames.find((n) => normalizeHeaderText(n) === normalizeHeaderText('Μαθητές')) ?? wb.SheetNames[0];
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

  const levelByNormalizedName = new Map<string, LevelRow>();
  levels.forEach((lvl) => levelByNormalizedName.set(normalizeText(lvl.name), lvl));

  const get = (row: unknown[], key: ImportColumnKey): string => {
    const idx = colIndexByKey.get(key);
    if (idx === undefined) return '';
    return cellToText(row[idx]);
  };

  const results: ParsedStudentRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

    const errors: string[] = [];
    const warnings: string[] = [];

    const fullName = get(row, 'full_name');
    if (!fullName) errors.push('Λείπει το ονοματεπώνυμο');

    const phone = get(row, 'phone') || null;
    const email = get(row, 'email') || null;
    if (!phone && !email) errors.push('Χρειάζεται τηλέφωνο ή email');

    const password = get(row, 'password') || null;
    if (password && password.length < 6) errors.push('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');

    const levelNameRaw = get(row, 'level_name');
    let levelId: string | null = null;
    if (levelNameRaw) {
      const match = levelByNormalizedName.get(normalizeText(levelNameRaw));
      if (match) levelId = match.id;
      else warnings.push(`Το επίπεδο «${levelNameRaw}» δεν βρέθηκε — ο μαθητής θα δημιουργηθεί χωρίς επίπεδο`);
    }

    const dateOfBirthIdx = colIndexByKey.get('date_of_birth');
    const dateOfBirth = dateOfBirthIdx !== undefined ? parseDateCell(row[dateOfBirthIdx], 'Ημ. Γέννησης', errors) : null;
    const fatherDobIdx = colIndexByKey.get('father_date_of_birth');
    const fatherDob = fatherDobIdx !== undefined ? parseDateCell(row[fatherDobIdx], 'Πατέρας - Ημ. Γέννησης', errors) : null;
    const motherDobIdx = colIndexByKey.get('mother_date_of_birth');
    const motherDob = motherDobIdx !== undefined ? parseDateCell(row[motherDobIdx], 'Μητέρα - Ημ. Γέννησης', errors) : null;

    const fatherAfm = validateAfm(get(row, 'father_afm'), 'Πατέρας - ΑΦΜ', errors);
    const motherAfm = validateAfm(get(row, 'mother_afm'), 'Μητέρα - ΑΦΜ', errors);

    results.push({
      rowNumber: i + 1,
      full_name: fullName,
      date_of_birth: dateOfBirth,
      phone,
      email,
      address: get(row, 'address') || null,
      school_name: get(row, 'school_name') || null,
      special_notes: get(row, 'special_notes') || null,
      password,
      level_id: levelId,
      father_name: get(row, 'father_name') || null,
      father_date_of_birth: fatherDob,
      father_phone: get(row, 'father_phone') || null,
      father_email: get(row, 'father_email') || null,
      father_afm: fatherAfm,
      mother_name: get(row, 'mother_name') || null,
      mother_date_of_birth: motherDob,
      mother_phone: get(row, 'mother_phone') || null,
      mother_email: get(row, 'mother_email') || null,
      mother_afm: motherAfm,
      errors,
      warnings,
    });
  }

  return results;
}
