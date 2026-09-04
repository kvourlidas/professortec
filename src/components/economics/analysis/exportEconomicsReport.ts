import { money } from '../utils';
import { breakLongTokens } from '../../../lib/pdfText';
import type { Mode, TxRow } from '../types';

function timestampedFilename(base: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${base}_${stamp}.${ext}`;
}

function sectionHeading(text: string) {
  return { text, style: 'section', margin: [0, 14, 0, 6] as [number, number, number, number] };
}

const KIND_LABEL: Record<TxRow['kind'], string> = { income: 'Έσοδο', expense: 'Έξοδο' };
const METHOD_LABEL: Record<'cash' | 'card' | 'bank_transfer', string> = { cash: 'Μετρητά', card: 'Κάρτα', bank_transfer: 'Τράπεζα' };

export type EconomicsReportInput = {
  mode: Mode;
  periodLabel: string;
  rangeStart: string;
  rangeEnd: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  outstandingBalance: number;
  collectionByMethod: { cash: number; card: number; bank_transfer: number };
  expenseByCategory: { category: string; amount: number }[];
  txRows: TxRow[];
};

export async function exportEconomicsReportToPdf(input: EconomicsReportInput) {
  const {
    periodLabel, rangeStart, rangeEnd, incomeTotal, expenseTotal, netTotal,
    outstandingBalance, collectionByMethod, expenseByCategory, txRows,
  } = input;

  const [{ default: pdfMake }, { default: robotoFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/fonts/Roboto'),
  ]);
  pdfMake.addFontContainer(robotoFonts);

  const generatedOn = new Date().toLocaleDateString('el-GR');

  const summaryTable = {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          { text: 'Έσοδα', bold: true, fontSize: 8 },
          { text: 'Έξοδα', bold: true, fontSize: 8 },
          { text: 'Καθαρό', bold: true, fontSize: 8 },
          { text: 'Οφειλές', bold: true, fontSize: 8 },
        ],
        [
          { text: money(incomeTotal), fontSize: 9, color: '#059669' },
          { text: money(expenseTotal), fontSize: 9, color: '#e11d48' },
          { text: money(netTotal), fontSize: 9, bold: true, color: netTotal >= 0 ? '#111111' : '#e11d48' },
          { text: money(outstandingBalance), fontSize: 9, color: '#d97706' },
        ],
      ],
    },
    layout: 'lightHorizontalLines' as const,
  };

  const collectionTable = {
    table: {
      widths: ['*', '*', '*'],
      body: [
        [
          { text: METHOD_LABEL.cash, bold: true, fontSize: 8 },
          { text: METHOD_LABEL.card, bold: true, fontSize: 8 },
          { text: METHOD_LABEL.bank_transfer, bold: true, fontSize: 8 },
        ],
        [
          { text: money(collectionByMethod.cash), fontSize: 9 },
          { text: money(collectionByMethod.card), fontSize: 9 },
          { text: money(collectionByMethod.bank_transfer), fontSize: 9 },
        ],
      ],
    },
    layout: 'lightHorizontalLines' as const,
  };

  let categoryContent;
  if (expenseByCategory.length === 0) {
    categoryContent = { text: 'Δεν υπάρχουν έξοδα στο φίλτρο.', fontSize: 8, color: '#888888' };
  } else {
    categoryContent = {
      table: {
        widths: ['*', 90],
        body: [
          [{ text: 'Κατηγορία', bold: true, fontSize: 8 }, { text: 'Ποσό', bold: true, fontSize: 8, alignment: 'right' as const }],
          ...expenseByCategory.map((c) => [
            { text: breakLongTokens(c.category), fontSize: 8 },
            { text: money(c.amount), fontSize: 8, alignment: 'right' as const },
          ]),
        ],
      },
      layout: 'lightHorizontalLines' as const,
    };
  }

  let txContent;
  if (txRows.length === 0) {
    txContent = { text: 'Δεν υπάρχουν κινήσεις στο φίλτρο.', fontSize: 8, color: '#888888' };
  } else {
    txContent = {
      table: {
        headerRows: 1,
        widths: [55, 45, '*', 70],
        body: [
          [
            { text: 'Ημερομηνία', bold: true, fontSize: 8 },
            { text: 'Τύπος', bold: true, fontSize: 8 },
            { text: 'Περιγραφή', bold: true, fontSize: 8 },
            { text: 'Ποσό', bold: true, fontSize: 8, alignment: 'right' as const },
          ],
          ...txRows.map((r) => [
            { text: r.date, fontSize: 7.5 },
            { text: KIND_LABEL[r.kind], fontSize: 7.5, color: r.kind === 'income' ? '#059669' : '#e11d48' },
            { text: breakLongTokens(r.label + (r.notes ? ` — ${r.notes}` : '')), fontSize: 7.5 },
            { text: `${r.kind === 'income' ? '+' : '−'} ${money(r.amount)}`, fontSize: 7.5, alignment: 'right' as const, color: r.kind === 'income' ? '#059669' : '#e11d48' },
          ]),
        ],
      },
      layout: 'lightHorizontalLines' as const,
    };
  }

  const content: unknown[] = [
    { text: 'Οικονομική Αναφορά', style: 'title' },
    { text: periodLabel, style: 'subtitleName' },
    { text: `Περίοδος: ${rangeStart} → ${rangeEnd} · Δημιουργήθηκε: ${generatedOn}`, style: 'subtitle', margin: [0, 0, 0, 10] as [number, number, number, number] },

    sectionHeading('Σύνοψη'),
    summaryTable,

    sectionHeading('Είσπραξη ανά τρόπο πληρωμής'),
    collectionTable,

    sectionHeading('Έξοδα ανά κατηγορία'),
    categoryContent,

    sectionHeading('Κινήσεις (έσοδα / έξοδα)'),
    txContent,
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

  const safePeriod = periodLabel
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_');
  await pdfMake.createPdf(docDefinition).download(timestampedFilename(`oikonomiki_anafora_${safePeriod}`, 'pdf'));
}
