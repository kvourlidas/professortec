import type { StudentRow } from './types';
import { formatDateToGreek } from './types';
import { breakLongTokensInRow } from '../../lib/pdfText';

function levelName(s: StudentRow, levelNameById: Map<string, string>): string {
  return s.level_id ? (levelNameById.get(s.level_id) ?? '') : '';
}

const STUDENT_HEADERS = [
  'Ονοματεπώνυμο', 'Επίπεδο', 'Ημ. Γέννησης', 'Τηλέφωνο', 'Email',
  'Διεύθυνση', 'Σχολείο', 'Σημειώσεις',
];

const PARENT_HEADERS = [
  'Πατέρας - Ονοματεπώνυμο', 'Πατέρας - Ημ. Γέννησης', 'Πατέρας - Τηλέφωνο', 'Πατέρας - Email', 'Πατέρας - ΑΦΜ',
  'Μητέρα - Ονοματεπώνυμο', 'Μητέρα - Ημ. Γέννησης', 'Μητέρα - Τηλέφωνο', 'Μητέρα - Email', 'Μητέρα - ΑΦΜ',
];

function studentRowValues(s: StudentRow, levelNameById: Map<string, string>): string[] {
  return [
    s.full_name ?? '',
    levelName(s, levelNameById),
    formatDateToGreek(s.date_of_birth),
    s.phone ?? '',
    s.email ?? '',
    s.address ?? '',
    s.school_name ?? '',
    s.special_notes ?? '',
  ];
}

function parentRowValues(s: StudentRow): string[] {
  return [
    s.father_name ?? '', formatDateToGreek(s.father_date_of_birth), s.father_phone ?? '', s.father_email ?? '', s.father_afm ?? '',
    s.mother_name ?? '', formatDateToGreek(s.mother_date_of_birth), s.mother_phone ?? '', s.mother_email ?? '', s.mother_afm ?? '',
  ];
}

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

export async function exportStudentsToExcel(students: StudentRow[], levelNameById: Map<string, string>) {
  const XLSX = await import('xlsx');

  const headers = [...STUDENT_HEADERS, ...PARENT_HEADERS];
  const rows = students.map((s) => [...studentRowValues(s, levelNameById), ...parentRowValues(s)]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, Math.min(28, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Μαθητές');
  XLSX.writeFile(wb, timestampedFilename('mathites', 'xlsx'));
}

export async function exportStudentsToPdf(students: StudentRow[], levelNameById: Map<string, string>) {
  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const studentBody = [
    STUDENT_HEADERS,
    ...students.map((s) => breakLongTokensInRow(studentRowValues(s, levelNameById))),
  ];
  const parentBody = [
    ['Ονοματεπώνυμο', ...PARENT_HEADERS],
    ...students.map((s) => breakLongTokensInRow([s.full_name ?? '', ...parentRowValues(s)])),
  ];

  const generatedOn = new Date().toLocaleDateString('el-GR');

  const docDefinition = {
    pageOrientation: 'landscape' as const,
    pageMargins: [24, 32, 24, 32] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [
      { text: 'Στοιχεία Μαθητών', style: 'title' },
      { text: `Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        table: { headerRows: 1, widths: [70, 45, 42, 48, 85, 90, 65, '*'], body: studentBody },
        layout: 'lightHorizontalLines',
      },
      { text: 'Στοιχεία Γονέων', style: 'title', pageBreak: 'before' as const },
      { text: `Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        table: {
          headerRows: 1,
          widths: [60, 65, 42, 48, 75, 42, 65, 42, 48, 75, 42],
          body: parentBody,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { fontSize: 13, bold: true },
      subtitle: { fontSize: 8, color: '#666666' },
    },
  };

  await pdfMake.createPdf(docDefinition).download(timestampedFilename('mathites', 'pdf'));
}
