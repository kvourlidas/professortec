import type { ClassRow, ProgramItemRow, SubjectRow } from './types';
import { DAY_OPTIONS } from './constants';
import { formatTimeDisplay } from './utils';

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

export async function exportProgramToPdf(
  itemsByDay: Record<string, ProgramItemRow[]>,
  classes: ClassRow[],
  subjectById: Map<string, SubjectRow>,
  tutorNameById: Map<string, string>,
  yearLabel: string | null,
) {
  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const headerRow = DAY_OPTIONS.map((d) => ({
    text: d.label,
    bold: true,
    fontSize: 8,
    alignment: 'center' as const,
    fillColor: '#f1f5f9',
  }));

  const dayColumn = (day: string) => {
    const slots = itemsByDay[day] ?? [];
    if (slots.length === 0) {
      return { text: '—', color: '#aaaaaa', fontSize: 7, margin: [2, 4, 2, 4] as [number, number, number, number] };
    }
    return {
      stack: slots.map((item, idx) => {
        const cls = classes.find((c) => c.id === item.class_id);
        if (!cls) return { text: '' };
        const subj = item.subject_id
          ? subjectById.get(item.subject_id)
          : cls.subject_id ? subjectById.get(cls.subject_id) : null;
        const subjName = subj?.name ?? cls.subject ?? '';
        const tutorName = item.tutor_id
          ? (tutorNameById.get(item.tutor_id) ?? '')
          : cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
        const timeRange = item.start_time && item.end_time
          ? `${formatTimeDisplay(item.start_time)} – ${formatTimeDisplay(item.end_time)}`
          : '';

        const lines: { text: string; bold?: boolean; fontSize: number; color?: string }[] = [
          { text: cls.title, bold: true, fontSize: 7.5 },
        ];
        if (subjName) lines.push({ text: subjName, fontSize: 6.5, color: '#555555' });
        if (timeRange) lines.push({ text: timeRange, fontSize: 6.5, color: '#0f766e' });
        if (tutorName) lines.push({ text: tutorName, fontSize: 6.5, color: '#555555' });
        if (item.room) lines.push({ text: `Αίθουσα ${item.room}`, fontSize: 6.5, color: '#888888' });

        return {
          stack: lines,
          margin: [2, idx === 0 ? 2 : 8, 2, 2] as [number, number, number, number],
        };
      }),
    };
  };

  const bodyRow = DAY_OPTIONS.map((d) => dayColumn(d.value));

  const generatedOn = new Date().toLocaleDateString('el-GR');

  const docDefinition = {
    pageOrientation: 'landscape' as const,
    pageMargins: [24, 32, 24, 32] as [number, number, number, number],
    defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [
      { text: 'Εβδομαδιαίο Πρόγραμμα', style: 'title' },
      {
        text: `Δημιουργήθηκε: ${generatedOn}${yearLabel ? ` · Σχολικό έτος: ${yearLabel}` : ''}`,
        style: 'subtitle',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        table: {
          headerRows: 1,
          widths: Array(DAY_OPTIONS.length).fill('*'),
          body: [headerRow, bodyRow],
        },
      },
    ],
    styles: {
      title: { fontSize: 13, bold: true },
      subtitle: { fontSize: 8, color: '#666666' },
    },
  };

  await pdfMake.createPdf(docDefinition).download(timestampedFilename('evdomadiaio_programma', 'pdf'));
}
