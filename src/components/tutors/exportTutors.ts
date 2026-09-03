import type { SpecialtyRow, TutorRow } from './types';
import { formatDateToGreek } from './utils';
import { breakLongTokensInRow } from '../../lib/pdfText';

const HEADERS = [
  'Ονοματεπώνυμο', 'Ειδικότητες', 'Ημ. Γέννησης', 'Ημ. Πρόσληψης',
  'ΑΦΜ', 'Τηλέφωνο', 'Email', 'IBAN', 'Σημειώσεις',
];

// International display convention (groups of 4) — also gives the PDF a
// natural place to wrap instead of overflowing as one unbroken token.
function formatIban(iban: string | null): string {
  if (!iban) return '';
  const compact = iban.replace(/\s+/g, '');
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

function rowValues(t: TutorRow, specialtyMap: Map<string, SpecialtyRow[]>): string[] {
  return [
    t.full_name ?? '',
    (specialtyMap.get(t.id) ?? []).map((s) => s.name).join(', '),
    formatDateToGreek(t.date_of_birth),
    formatDateToGreek(t.hire_date),
    t.afm ?? '',
    t.phone ?? '',
    t.email ?? '',
    formatIban(t.iban),
    t.notes ?? '',
  ];
}

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

export async function exportTutorsToExcel(tutors: TutorRow[], specialtyMap: Map<string, SpecialtyRow[]>) {
  const XLSX = await import('xlsx');

  const rows = tutors.map((t) => rowValues(t, specialtyMap));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(12, Math.min(30, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Καθηγητές');
  XLSX.writeFile(wb, timestampedFilename('kathigites', 'xlsx'));
}

export async function exportTutorsToPdf(tutors: TutorRow[], specialtyMap: Map<string, SpecialtyRow[]>) {
  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const body = [
    HEADERS,
    ...tutors.map((t) => breakLongTokensInRow(rowValues(t, specialtyMap))),
  ];
  const generatedOn = new Date().toLocaleDateString('el-GR');

  const docDefinition = {
    pageOrientation: 'landscape' as const,
    pageMargins: [24, 32, 24, 32] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [
      { text: 'Στοιχεία Καθηγητών', style: 'title' },
      { text: `Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        table: {
          headerRows: 1,
          widths: [70, 60, 40, 40, 42, 45, 90, 70, '*'],
          body,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { fontSize: 13, bold: true },
      subtitle: { fontSize: 8, color: '#666666' },
    },
  };

  await pdfMake.createPdf(docDefinition).download(timestampedFilename('kathigites', 'pdf'));
}
