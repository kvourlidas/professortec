import type { ClassRow, SubjectRow } from './types';
import type { StudentRow } from './ClassesGrid';
import { breakLongTokensInRow } from '../../lib/pdfText';

const HEADERS = ['Επίπεδο', 'Τμήμα', 'Μαθήματα', 'Αριθμός Μαθητών', 'Μαθητές'];

type ClassExportRow = {
  levelName: string;
  title: string;
  subjectNames: string;
  studentCount: number;
  studentNames: string;
};

function buildRows(
  classes: ClassRow[],
  subjects: SubjectRow[],
  levelNameById: Map<string, string>,
  studentsByClass: Record<string, StudentRow[]>,
): ClassExportRow[] {
  const rows = classes.map((c) => {
    const subj = c.subject_id ? subjects.find((s) => s.id === c.subject_id) : null;
    const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? 'Χωρίς επίπεδο') : 'Χωρίς επίπεδο';
    const subjectNames = c.subject ? c.subject.split(',').map((s) => s.trim()).filter(Boolean).join(', ') : '—';
    const students = studentsByClass[c.id] ?? [];
    return {
      levelName,
      title: c.title,
      subjectNames,
      studentCount: students.length,
      studentNames: students.map((st) => st.full_name ?? 'Χωρίς όνομα').join(', ') || '—',
    };
  });
  return rows.sort((a, b) => {
    if (a.levelName === 'Χωρίς επίπεδο' && b.levelName !== 'Χωρίς επίπεδο') return 1;
    if (b.levelName === 'Χωρίς επίπεδο' && a.levelName !== 'Χωρίς επίπεδο') return -1;
    const lvlCmp = a.levelName.localeCompare(b.levelName, 'el');
    if (lvlCmp !== 0) return lvlCmp;
    return a.title.localeCompare(b.title, 'el');
  });
}

function rowValues(r: ClassExportRow): string[] {
  return [r.levelName, r.title, r.subjectNames, String(r.studentCount), r.studentNames];
}

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

export async function exportClassesToExcel(
  classes: ClassRow[],
  subjects: SubjectRow[],
  levelNameById: Map<string, string>,
  studentsByClass: Record<string, StudentRow[]>,
) {
  const XLSX = await import('xlsx');

  const rows = buildRows(classes, subjects, levelNameById, studentsByClass);
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows.map(rowValues)]);
  ws['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Τμήματα');
  XLSX.writeFile(wb, timestampedFilename('tmimata', 'xlsx'));
}

export async function exportClassesToPdf(
  classes: ClassRow[],
  subjects: SubjectRow[],
  levelNameById: Map<string, string>,
  studentsByClass: Record<string, StudentRow[]>,
) {
  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const rows = buildRows(classes, subjects, levelNameById, studentsByClass);
  const generatedOn = new Date().toLocaleDateString('el-GR');

  const body = [
    HEADERS,
    ...rows.map((r) => breakLongTokensInRow(rowValues(r))),
  ];

  const docDefinition = {
    pageOrientation: 'landscape' as const,
    pageMargins: [24, 32, 24, 32] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [
      { text: 'Τμήματα', style: 'title' },
      { text: `Σύνολο: ${rows.length} τμήματα · Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        table: { headerRows: 1, widths: [65, 75, 90, 55, '*'], body },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { fontSize: 13, bold: true },
      subtitle: { fontSize: 8, color: '#666666' },
    },
  };

  await pdfMake.createPdf(docDefinition).download(timestampedFilename('tmimata', 'pdf'));
}
