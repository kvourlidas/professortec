// pdfmake only wraps text at spaces. A long unbroken token (IBAN, email,
// URL, ...) that's wider than its column just overflows the page and can
// push every column after it off the visible area. Splitting long tokens
// with zero-width spaces gives pdfmake break points without changing how
// the text looks.
const ZERO_WIDTH_SPACE = '​';

export function breakLongTokens(text: string, maxLen = 12): string {
  if (!text) return text;
  return text
    .split(' ')
    .map((word) => {
      if (word.length <= maxLen) return word;
      const chunks: string[] = [];
      for (let i = 0; i < word.length; i += maxLen) chunks.push(word.slice(i, i + maxLen));
      return chunks.join(ZERO_WIDTH_SPACE);
    })
    .join(' ');
}

export function breakLongTokensInRow(row: string[]): string[] {
  return row.map((cell) => breakLongTokens(cell));
}
