import type { Dots } from './cell';

/**
 * One translated braille cell plus what it stands for, so the UI can explain any cell on hover
 * without knowing any braille rules itself.
 */
export interface BrailleCell {
  dots: Dots;
  /** Indicators modify the cells after them, so a line break must never fall right after one. */
  kind: 'letter' | 'digit' | 'punctuation' | 'indicator';
  /** The print text this cell came from (e.g. "a", "?", "4"); '' for indicators and spaces. */
  print: string;
  /** Plain-English meaning, e.g. "letter a", "Capital sign: the next letter is uppercase". */
  name: string;
}

/** A translated word: everything between two spaces, including attached punctuation. */
export interface BrailleWord {
  print: string;
  cells: BrailleCell[];
}

/** A paragraph is a list of words; lines inside the input become separate paragraphs. */
export type Paragraph = BrailleWord[];

export interface Translation {
  paragraphs: Paragraph[];
  /** Human-readable notes about anything that couldn't be translated exactly. */
  warnings: string[];
}

export type Grade = 1 | 2;

/**
 * A braille translator for one grade. Grade 1 (uncontracted) and a future Grade 2 (contracted)
 * both plug in here, so the layout and UI never need to know which grade produced the cells.
 */
export interface Translator {
  grade: Grade;
  label: string;
  /** Translate one paragraph's words (already split on whitespace). */
  translateParagraph(words: string[], warnings: Set<string>): Paragraph;
}
