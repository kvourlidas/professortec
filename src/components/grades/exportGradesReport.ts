import { formatDate, formatTime } from './utils';
import { breakLongTokens } from '../../lib/pdfText';
import type { GradeRow } from './types';

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

function sectionHeading(text: string) {
  return { text, style: 'section', margin: [0, 14, 0, 6] as [number, number, number, number] };
}

function statsOf(grades: GradeRow[]) {
  const valid = grades.filter((g) => typeof g.grade === 'number').map((g) => g.grade as number);
  const avg = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  const highest = valid.length > 0 ? Math.max(...valid) : null;
  return { count: grades.length, avg, highest };
}

function summaryTable(grades: GradeRow[]) {
  const { count, avg, highest } = statsOf(grades);
  return {
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          { text: 'Διαγωνίσματα', bold: true, fontSize: 8 },
          { text: 'Μ.Ο. Βαθμών', bold: true, fontSize: 8 },
          { text: 'Υψηλότερος', bold: true, fontSize: 8 },
        ],
        [
          { text: String(count), fontSize: 9 },
          { text: avg !== null ? avg.toFixed(1) : '—', fontSize: 9, bold: true },
          { text: highest !== null ? String(highest) : '—', fontSize: 9 },
        ],
      ],
    },
    layout: 'lightHorizontalLines' as const,
  };
}

function gradesTable(grades: GradeRow[], includeSubjectColumn: boolean) {
  if (grades.length === 0) {
    return { text: 'Δεν υπάρχουν βαθμοί για την επιλεγμένη περίοδο.', fontSize: 8, color: '#888888' };
  }
  const widths = includeSubjectColumn ? [45, 35, '*', 65, 65, 40] : [50, 40, '*', 80, 45];
  const headerRow = includeSubjectColumn
    ? [
        { text: 'Ημερομηνία', bold: true, fontSize: 8 },
        { text: 'Ώρα', bold: true, fontSize: 8 },
        { text: 'Διαγώνισμα', bold: true, fontSize: 8 },
        { text: 'Μάθημα', bold: true, fontSize: 8 },
        { text: 'Τμήμα', bold: true, fontSize: 8 },
        { text: 'Βαθμός', bold: true, fontSize: 8, alignment: 'right' as const },
      ]
    : [
        { text: 'Ημερομηνία', bold: true, fontSize: 8 },
        { text: 'Ώρα', bold: true, fontSize: 8 },
        { text: 'Διαγώνισμα', bold: true, fontSize: 8 },
        { text: 'Τμήμα', bold: true, fontSize: 8 },
        { text: 'Βαθμός', bold: true, fontSize: 8, alignment: 'right' as const },
      ];
  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        headerRow,
        ...grades.map((g) => {
          const row: { text: string; fontSize: number; bold?: boolean; alignment?: 'left' | 'right' | 'center' }[] = [
            { text: formatDate(g.test_date), fontSize: 7.5 },
            { text: formatTime(g.start_time) + (g.end_time ? ` – ${formatTime(g.end_time)}` : ''), fontSize: 7.5 },
            { text: breakLongTokens(g.test_name ?? '—'), fontSize: 7.5 },
          ];
          if (includeSubjectColumn) row.push({ text: breakLongTokens(g.subject_name ?? '—'), fontSize: 7.5 });
          row.push({ text: breakLongTokens(g.class_title ?? '—'), fontSize: 7.5 });
          row.push({ text: g.grade !== null ? String(g.grade) : '—', fontSize: 7.5, bold: g.grade !== null, alignment: 'right' as const });
          return row;
        }),
      ],
    },
    layout: 'lightHorizontalLines' as const,
  };
}

export type GradesReportInput = {
  roleLabel: 'Μαθητής' | 'Καθηγητής';
  subjectName: string;
  periodLabel: string;
  grades: GradeRow[];
};

export async function exportGradesReportToPdf(input: GradesReportInput) {
  const { roleLabel, subjectName, periodLabel, grades } = input;

  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const generatedOn = new Date().toLocaleDateString('el-GR');

  const sortedByDate = [...grades].sort((a, b) => {
    const da = a.test_date ?? '';
    const db = b.test_date ?? '';
    return da < db ? 1 : da > db ? -1 : 0;
  });

  const bySubject = new Map<string, { name: string; rows: GradeRow[] }>();
  for (const g of sortedByDate) {
    const key = g.subject_id ?? '__none__';
    const name = g.subject_name ?? 'Χωρίς μάθημα';
    if (!bySubject.has(key)) bySubject.set(key, { name, rows: [] });
    bySubject.get(key)!.rows.push(g);
  }
  const subjectGroups = Array.from(bySubject.values()).sort((a, b) => a.name.localeCompare(b.name, 'el'));

  const content: unknown[] = [
    { text: 'Αναφορά Βαθμών', style: 'title' },
    { text: `${roleLabel}: ${subjectName}`, style: 'subtitleName' },
    { text: `${periodLabel} · Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },

    sectionHeading('Γενική Σύνοψη'),
    summaryTable(sortedByDate),

    sectionHeading('Όλα τα Διαγωνίσματα'),
    gradesTable(sortedByDate, true),

    { text: 'Ανά Μάθημα', style: 'section', pageBreak: 'before' as const, margin: [0, 0, 0, 6] as [number, number, number, number] },
    ...(subjectGroups.length === 0
      ? [{ text: 'Δεν υπάρχουν βαθμοί για την επιλεγμένη περίοδο.', fontSize: 8, color: '#888888' }]
      : subjectGroups.flatMap((sg) => {
          const { avg, count } = statsOf(sg.rows);
          return [
            {
              text: `${sg.name}  ·  ${count} διαγωνίσματα${avg !== null ? `  ·  Μ.Ο. ${avg.toFixed(1)}` : ''}`,
              fontSize: 9,
              bold: true,
              color: '#111111',
              margin: [0, 12, 0, 5] as [number, number, number, number],
            },
            gradesTable(sg.rows, false),
          ];
        })),
  ];

  const docDefinition = {
    pageOrientation: 'portrait' as const,
    pageMargins: [36, 36, 36, 36] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    content,
    styles: {
      title: { fontSize: 15, bold: true },
      subtitleName: { fontSize: 11, bold: true, color: '#333333', margin: [0, 2, 0, 0] },
      subtitle: { fontSize: 8, color: '#666666' },
      section: { fontSize: 10, bold: true, color: '#111111' },
    },
  };

  const safeName = subjectName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_');
  await pdfMake.createPdf(docDefinition).download(timestampedFilename(`anafora_bathmwn_${safeName}`, 'pdf'));
}
