// Unified English Braille, Grade 1 (uncontracted): every print letter gets its own cell, plus the
// indicators UEB needs for capitals and numbers. Rules implemented (UEB Rulebook section numbers):
//
// - Capitals (§8): ⠠ before one capital letter; ⠠⠠ before two or more capitals in a row. Any
//   non-letter (apostrophe, hyphen, digit…) ends the ⠠⠠ effect. If lowercase letters follow
//   capitals inside the same run of letters, ⠠⠄ ends capitals first ("CDs" → ⠠⠠⠉⠙⠠⠄⠎).
//   Three or more fully capitalized words in a row use the passage sign ⠠⠠⠠ … ⠠⠄, with the
//   terminator after the last word's punctuation.
// - Numbers (§6): ⠼ starts numeric mode; digits 1–0 are the letters a–j. A period or comma
//   between digits stays in numeric mode. Any other symbol or a space ends it. A lowercase a–j
//   right after a digit takes the Grade 1 sign ⠰ so it isn't read as a digit.
// - Punctuation (§7): see symbols.ts. Straight double quotes are resolved to opening/closing by
//   position; a straight single quote is always an apostrophe.

import {
  DIGITS,
  INDICATORS,
  LETTERS,
  NUMERIC_PUNCTUATION,
  PUNCTUATION,
  QUOTES,
  SEQUENCES,
  type IndicatorKey,
  type SymbolDef,
} from './symbols';
import type { BrailleCell, Paragraph, Translator } from './types';

const isUpper = (c: string) => c >= 'A' && c <= 'Z';
const isLower = (c: string) => c >= 'a' && c <= 'z';
const isLetter = (c: string) => isUpper(c) || isLower(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlnum = (c: string) => isLetter(c) || isDigit(c);

/** A word counts toward a capitals passage if it has letters and none of them are lowercase. */
function isAllCaps(word: string): boolean {
  return [...word].some(isUpper) && ![...word].some(isLower);
}

/** Strip accents so "café" becomes "cafe"; report anything we changed or can't represent. */
function normalize(word: string, warnings: Set<string>): string {
  let out = '';
  for (const ch of word) {
    if (isAlnum(ch) || PUNCTUATION[ch] || `'"‘’“”`.includes(ch)) {
      out += ch;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base.length === 1 && isLetter(base)) {
      warnings.add(`Accent dropped: "${ch}" written as "${base}".`);
      out += base;
    } else {
      warnings.add(`No braille symbol for "${ch}"; it was left out.`);
    }
  }
  return out;
}

interface PassageInfo {
  start: boolean;
  inside: boolean;
  end: boolean;
}

/** Mark which words start, are inside, or end a run of 3+ fully capitalized words. */
function findPassages(words: string[]): PassageInfo[] {
  const info = words.map(() => ({ start: false, inside: false, end: false }));
  let i = 0;
  while (i < words.length) {
    let j = i;
    while (j < words.length && isAllCaps(words[j]!)) j++;
    if (j - i >= 3) {
      for (let k = i; k < j; k++) info[k]!.inside = true;
      info[i]!.start = true;
      info[j - 1]!.end = true;
    }
    i = Math.max(j, i + 1);
  }
  return info;
}

class WordWriter {
  readonly cells: BrailleCell[] = [];

  indicator(key: IndicatorKey): void {
    const { dots, name } = INDICATORS[key];
    if (key === 'capitalTerminator') {
      // The terminator belongs with the capitals before it, not with what follows.
      const prev = this.cells.at(-1);
      if (prev) prev.joinNext = true;
      dots.forEach((d, i) => {
        const cell: BrailleCell = { dots: d, kind: 'indicator', print: '', name };
        if (i < dots.length - 1) cell.joinNext = true;
        this.cells.push(cell);
      });
      return;
    }
    for (const d of dots) {
      this.cells.push({ dots: d, kind: 'indicator', print: '', name, joinNext: true });
    }
  }

  symbol(def: SymbolDef, print: string, mode?: 'numeric'): void {
    def.dots.forEach((d, i) => {
      const part = def.dots.length > 1 ? ` (cell ${i + 1} of ${def.dots.length})` : '';
      const cell: BrailleCell = { dots: d, kind: 'punctuation', print, name: def.name + part };
      if (i < def.dots.length - 1) cell.joinNext = true;
      if (mode) cell.mode = mode;
      this.cells.push(cell);
    });
  }

  letter(ch: string, capitalsWord = false): void {
    const lower = ch.toLowerCase();
    const name = isUpper(ch) ? `letter ${lower} (uppercase ${ch})` : `letter ${lower}`;
    const cell: BrailleCell = { dots: LETTERS[lower]!, kind: 'letter', print: ch, name };
    if (capitalsWord) cell.mode = 'capitals';
    this.cells.push(cell);
  }

  digit(ch: string): void {
    this.cells.push({
      dots: DIGITS[ch]!,
      kind: 'digit',
      print: ch,
      name: `digit ${ch}`,
      mode: 'numeric',
    });
  }
}

/** Write one run of consecutive letters, adding capital indicators as UEB requires. */
function writeLetterRun(w: WordWriter, run: string, inPassage: boolean): void {
  if (inPassage) {
    for (const ch of run) w.letter(ch);
    return;
  }
  let p = 0;
  while (p < run.length) {
    if (!isUpper(run[p]!)) {
      w.letter(run[p]!);
      p++;
      continue;
    }
    let k = p;
    while (k < run.length && isUpper(run[k]!)) k++;
    if (k - p >= 2) {
      w.indicator('capitalWord');
      for (let q = p; q < k; q++) w.letter(run[q]!, true);
      if (k < run.length) w.indicator('capitalTerminator');
    } else {
      w.indicator('capitalLetter');
      w.letter(run[p]!);
    }
    p = k;
  }
}

interface QuoteState {
  singleOpen: boolean;
}

function translateWord(word: string, passage: PassageInfo, quotes: QuoteState): BrailleCell[] {
  const w = new WordWriter();
  const chars = [...word];
  let numeric = false;

  if (passage.start) w.indicator('capitalPassage');

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    const next = chars[i + 1] ?? '';

    if (isDigit(ch)) {
      if (!numeric) w.indicator('numeric');
      numeric = true;
      w.digit(ch);
      i++;
      continue;
    }

    if (numeric && (ch === '.' || ch === ',') && isDigit(next)) {
      w.symbol(NUMERIC_PUNCTUATION[ch]!, ch, 'numeric');
      i++;
      continue;
    }

    if (isLetter(ch)) {
      let j = i;
      while (j < chars.length && isLetter(chars[j]!)) j++;
      // A capital sign already ends numeric mode, so only lowercase a–j needs the Grade 1 sign.
      if (numeric && ch >= 'a' && ch <= 'j') w.indicator('grade1');
      numeric = false;
      writeLetterRun(w, chars.slice(i, j).join(''), passage.inside);
      i = j;
      continue;
    }

    numeric = false;

    const seq = Object.keys(SEQUENCES).find((s) => chars.slice(i, i + s.length).join('') === s);
    if (seq) {
      w.symbol(SEQUENCES[seq]!, seq);
      i += seq.length;
      continue;
    }

    const before = chars.slice(0, i);
    const after = chars.slice(i + 1);
    const alnumBefore = before.some(isAlnum);
    const alnumAfter = after.some(isAlnum);

    if (ch === '"' || ch === '“' || ch === '”') {
      const opening = ch === '“' || (ch === '"' && !alnumBefore);
      w.symbol(opening ? QUOTES.openDouble : QUOTES.closeDouble, ch);
    } else if (ch === '‘' || ch === '’') {
      if (ch === '‘') {
        quotes.singleOpen = true;
        w.symbol(QUOTES.openSingle, ch);
      } else if (quotes.singleOpen && alnumBefore && !alnumAfter) {
        quotes.singleOpen = false;
        w.symbol(QUOTES.closeSingle, ch);
      } else {
        w.symbol(QUOTES.apostrophe, ch);
      }
    } else if (ch === "'") {
      // A straight ' is too ambiguous to treat as a quote mark ('em, '90s), so like liblouis we
      // always write it as an apostrophe. Curly quotes give proper single quotation marks.
      w.symbol(QUOTES.apostrophe, ch);
    } else {
      // normalize() guarantees anything left is in the punctuation table.
      w.symbol(PUNCTUATION[ch]!, ch);
    }
    i++;
  }

  // The passage terminator follows the whole last word, punctuation included (UEB §8.6).
  if (passage.end) w.indicator('capitalTerminator');
  return w.cells;
}

export const grade1: Translator = {
  grade: 1,
  label: 'Grade 1 (uncontracted)',
  translateParagraph(rawWords, warnings): Paragraph {
    const words = rawWords.map((word) => normalize(word, warnings)).filter((word) => word !== '');
    const passages = findPassages(words);
    const quotes: QuoteState = { singleOpen: false };
    return words.map((print, i) => ({
      print,
      cells: translateWord(print, passages[i]!, quotes),
    }));
  },
};
