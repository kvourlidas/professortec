import type { StudentRow, ClassEnrollment, ProgramSlot, SubscriptionRow } from './types';
import { formatDateToGreek } from './types';
import type { StudentGradeRow } from '../grades/types';
import { breakLongTokensInRow } from '../../lib/pdfText';

const DAY_LABEL: Record<string, string> = {
  monday: 'Δευτέρα', tuesday: 'Τρίτη', wednesday: 'Τετάρτη',
  thursday: 'Πέμπτη', friday: 'Παρασκευή', saturday: 'Σάββατο', sunday: 'Κυριακή',
};

function fmt12(t: string | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr); const m = Number(mStr ?? 0);
  const period = h < 12 ? 'πμ' : 'μμ';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

function sectionHeading(text: string) {
  return { text, style: 'section', margin: [0, 14, 0, 6] as [number, number, number, number] };
}

function kvTable(rows: [string, string][]) {
  return {
    table: {
      widths: [110, '*'],
      body: rows.map(([label, value]) => [
        { text: label, bold: true, fontSize: 8, color: '#555555' },
        { text: value || '—', fontSize: 8 },
      ]),
    },
    layout: 'lightHorizontalLines' as const,
  };
}

export type StudentReportInput = {
  student: StudentRow;
  levelName: string;
  isIdiaiterou: boolean;
  classes: ClassEnrollment[];
  scheduleSlots: ProgramSlot[];
  grades: StudentGradeRow[];
  trimesterInputs: Record<1 | 2 | 3, string> | null;
  trimesterYearName: string | null;
  attendancePresent: number;
  attendanceAbsent: number;
  attendancePeriodLabel: string;
  activeSub: SubscriptionRow | null;
  totals: { charged: number; paid: number; balance: number };
};

export async function exportStudentReportToPdf(input: StudentReportInput) {
  const {
    student, levelName, isIdiaiterou, classes, scheduleSlots, grades,
    trimesterInputs, trimesterYearName, attendancePresent, attendanceAbsent,
    attendancePeriodLabel, activeSub, totals,
  } = input;

  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const generatedOn = new Date().toLocaleDateString('el-GR');

  // ── Στοιχεία μαθητή ──
  const studentInfo = kvTable([
    ['Ονοματεπώνυμο', student.full_name ?? ''],
    ['Επίπεδο', levelName],
    ['Ημ. Γέννησης', formatDateToGreek(student.date_of_birth)],
    ['Τηλέφωνο', student.phone ?? ''],
    ['Email', student.email ?? ''],
    ['Διεύθυνση', student.address ?? ''],
    ['Σχολείο', student.school_name ?? ''],
    ['Λογαριασμός', student.auth_user_id ? 'Ενεργός' : 'Ανενεργός'],
  ]);

  // ── Στοιχεία γονέων ──
  const parentsTable = {
    table: {
      widths: [90, '*', '*'],
      body: [
        [{ text: '', fontSize: 8 }, { text: 'Πατέρας', bold: true, fontSize: 8 }, { text: 'Μητέρα', bold: true, fontSize: 8 }],
        ['Ονοματεπώνυμο', student.father_name ?? '—', student.mother_name ?? '—'],
        ['Ημ. Γέννησης', formatDateToGreek(student.father_date_of_birth), formatDateToGreek(student.mother_date_of_birth)],
        ['Τηλέφωνο', student.father_phone ?? '—', student.mother_phone ?? '—'],
        ['Email', student.father_email ?? '—', student.mother_email ?? '—'],
        ['ΑΦΜ', student.father_afm ?? '—', student.mother_afm ?? '—'],
      ].map((row, i) => (i === 0 ? row : breakLongTokensInRow(row as string[]).map((v, ci) => (
        ci === 0 ? { text: v, bold: true, fontSize: 8, color: '#555555' } : { text: v, fontSize: 8 }
      )))),
    },
    layout: 'lightHorizontalLines' as const,
  };

  // ── Πρόγραμμα ──
  let programContent;
  if (isIdiaiterou) {
    if (scheduleSlots.length === 0) {
      programContent = { text: 'Δεν έχει οριστεί ωράριο.', fontSize: 8, color: '#888888' };
    } else {
      programContent = {
        table: {
          widths: [80, 110, '*'],
          body: [
            [{ text: 'Ημέρα', bold: true, fontSize: 8 }, { text: 'Ώρα', bold: true, fontSize: 8 }, { text: 'Μάθημα', bold: true, fontSize: 8 }],
            ...scheduleSlots.map((s) => [
              { text: DAY_LABEL[s.day_of_week] ?? s.day_of_week, fontSize: 8 },
              { text: `${fmt12(s.start_time)} – ${fmt12(s.end_time)}`, fontSize: 8 },
              { text: s.class_title ?? '—', fontSize: 8 },
            ]),
          ],
        },
        layout: 'lightHorizontalLines' as const,
      };
    }
  } else {
    if (classes.length === 0) {
      programContent = { text: 'Ο μαθητής δεν έχει ενταχθεί σε τμήμα.', fontSize: 8, color: '#888888' };
    } else {
      programContent = {
        ul: classes.filter((c) => c.classes).map((c) => `${c.classes!.title}${c.classes!.subject ? ` · ${c.classes!.subject}` : ''}`),
        fontSize: 8,
      };
    }
  }

  // ── Βαθμοί ──
  const gradedVals = grades.filter((g) => g.grade !== null).map((g) => Number(g.grade));
  const gradesAvg = gradedVals.length > 0 ? gradedVals.reduce((a, b) => a + b, 0) / gradedVals.length : null;

  let gradesContent;
  if (grades.length === 0) {
    gradesContent = { text: 'Δεν υπάρχουν καταχωρημένοι βαθμοί.', fontSize: 8, color: '#888888' };
  } else {
    gradesContent = {
      table: {
        widths: [55, '*', 70, 40],
        body: [
          [
            { text: 'Ημερομηνία', bold: true, fontSize: 8 },
            { text: 'Διαγώνισμα', bold: true, fontSize: 8 },
            { text: 'Τμήμα', bold: true, fontSize: 8 },
            { text: 'Βαθμός', bold: true, fontSize: 8 },
          ],
          ...grades.map((g) => [
            { text: g.test_date ? formatDateToGreek(g.test_date) : '—', fontSize: 8 },
            { text: [g.test_name ?? '—', g.subject_name ? ` (${g.subject_name})` : ''].join(''), fontSize: 8 },
            { text: g.class_title ?? '—', fontSize: 8 },
            { text: g.grade !== null ? String(g.grade) : '—', fontSize: 8, bold: g.grade !== null },
          ]),
        ],
      },
      layout: 'lightHorizontalLines' as const,
    };
  }

  const trimesterVals = trimesterInputs
    ? ([1, 2, 3] as const)
      .map((t) => { const v = (trimesterInputs[t] ?? '').replace(',', '.'); const n = parseFloat(v); return v !== '' && !isNaN(n) ? n : null; })
      .filter((v): v is number => v !== null)
    : [];
  const trimesterAvg = trimesterVals.length > 0 ? trimesterVals.reduce((a, b) => a + b, 0) / trimesterVals.length : null;

  // ── Παρουσιολόγιο ──
  const attendanceTotal = attendancePresent + attendanceAbsent;
  const attendancePct = attendanceTotal > 0 ? (attendancePresent / attendanceTotal) * 100 : null;

  // ── Οικονομικά ──
  const economicsRows: { text: string }[][] = [];
  if (!isIdiaiterou && activeSub) {
    economicsRows.push([{ text: `Ενεργή συνδρομή: ${activeSub.package_name}${activeSub.starts_on ? ` (${formatDateToGreek(activeSub.starts_on)} → ${activeSub.ends_on ? formatDateToGreek(activeSub.ends_on) : '—'})` : ''}` }]);
  }

  const content: unknown[] = [
    { text: 'Αναφορά Μαθητή', style: 'title' },
    { text: student.full_name ?? '', style: 'subtitleName' },
    { text: `Επίπεδο: ${levelName} · Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },

    sectionHeading('Στοιχεία Μαθητή'),
    studentInfo,

    sectionHeading('Στοιχεία Γονέων'),
    parentsTable,

    sectionHeading('Σημειώσεις'),
    { text: student.special_notes?.trim() || '—', fontSize: 8 },

    sectionHeading('Πρόγραμμα'),
    programContent,

    sectionHeading('Βαθμοί'),
    gradesContent,
    ...(gradesAvg !== null ? [{ text: `Μέσος όρος βαθμών: ${gradesAvg.toFixed(1)}`, fontSize: 8, bold: true, margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
    ...(!isIdiaiterou && trimesterInputs ? [
      { text: `Βαθμοί Τριμήνου${trimesterYearName ? ` (${trimesterYearName})` : ''}: 1ο ${trimesterInputs[1] || '—'} · 2ο ${trimesterInputs[2] || '—'} · 3ο ${trimesterInputs[3] || '—'}${trimesterAvg !== null ? ` · Μ.Ο. ${trimesterAvg.toFixed(1)}` : ''}`, fontSize: 8, margin: [0, 4, 0, 0] as [number, number, number, number] },
    ] : []),

    sectionHeading(`Παρουσιολόγιο (${attendancePeriodLabel})`),
    attendanceTotal === 0
      ? { text: 'Δεν υπάρχουν καταχωρημένες παρουσίες για αυτήν την περίοδο.', fontSize: 8, color: '#888888' }
      : { text: `Παρουσίες: ${attendancePresent}  ·  Απουσίες: ${attendanceAbsent}  ·  Ποσοστό παρουσίας: ${attendancePct !== null ? attendancePct.toFixed(0) : '—'}%`, fontSize: 8 },

    sectionHeading('Οικονομικά'),
    ...economicsRows.map((r) => ({ text: r[0].text, fontSize: 8, margin: [0, 0, 0, 4] as [number, number, number, number] })),
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [{ text: 'Συνολική Χρέωση', bold: true, fontSize: 8 }, { text: 'Πληρωμένο', bold: true, fontSize: 8 }, { text: 'Υπόλοιπο', bold: true, fontSize: 8 }],
          [
            { text: `${totals.charged.toFixed(2)}€`, fontSize: 9 },
            { text: `${totals.paid.toFixed(2)}€`, fontSize: 9, color: '#059669' },
            { text: `${totals.balance.toFixed(2)}€`, fontSize: 9, color: totals.balance > 0 ? '#dc2626' : '#059669' },
          ],
        ],
      },
      layout: 'lightHorizontalLines' as const,
    },
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

  const safeName = (student.full_name ?? 'mathitis')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_');
  await pdfMake.createPdf(docDefinition).download(timestampedFilename(`anafora_${safeName}`, 'pdf'));
}
