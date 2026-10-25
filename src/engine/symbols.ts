// Unified English Braille (UEB) symbol tables. Dot numbers follow the UEB Rulebook (2013) and
// the BANA "ABCs of UEB" guide. Every multi-cell symbol is listed cell by cell.

import { dotString, type Dots } from './cell';

export const LETTERS: Readonly<Record<string, Dots>> = {
  a: dotString('1'),
  b: dotString('12'),
  c: dotString('14'),
  d: dotString('145'),
  e: dotString('15'),
  f: dotString('124'),
  g: dotString('1245'),
  h: dotString('125'),
  i: dotString('24'),
  j: dotString('245'),
  k: dotString('13'),
  l: dotString('123'),
  m: dotString('134'),
  n: dotString('1345'),
  o: dotString('135'),
  p: dotString('1234'),
  q: dotString('12345'),
  r: dotString('1235'),
  s: dotString('234'),
  t: dotString('2345'),
  u: dotString('136'),
  v: dotString('1236'),
  w: dotString('2456'),
  x: dotString('1346'),
  y: dotString('13456'),
  z: dotString('1356'),
};

/** In numeric mode the digits 1–9, 0 reuse the letters a–j. */
export const DIGITS: Readonly<Record<string, Dots>> = {
  '1': LETTERS.a!,
  '2': LETTERS.b!,
  '3': LETTERS.c!,
  '4': LETTERS.d!,
  '5': LETTERS.e!,
  '6': LETTERS.f!,
  '7': LETTERS.g!,
  '8': LETTERS.h!,
  '9': LETTERS.i!,
  '0': LETTERS.j!,
};

/** Indicators: cells that change how the following cells are read. They stand for no print text. */
export const INDICATORS = {
  capitalLetter: { dots: [dotString('6')], name: 'Capital sign: the next letter is uppercase' },
  capitalWord: {
    dots: [dotString('6'), dotString('6')],
    name: 'Capital word sign: the following letters are uppercase',
  },
  capitalPassage: {
    dots: [dotString('6'), dotString('6'), dotString('6')],
    name: 'Capital passage sign: everything until the terminator is uppercase',
  },
  capitalTerminator: {
    dots: [dotString('6'), dotString('3')],
    name: 'Capitals terminator: uppercase ends here',
  },
  numeric: {
    dots: [dotString('3456')],
    name: 'Number sign: the following letters a–j are digits 1–0',
  },
  grade1: {
    dots: [dotString('56')],
    name: 'Grade 1 sign: the next cell is a letter, not a digit',
  },
  grade1Word: {
    dots: [dotString('56'), dotString('56')],
    name: 'Grade 1 word sign: this word is spelled out, with no contractions',
  },
  grade1Passage: {
    dots: [dotString('56'), dotString('56'), dotString('56')],
    name: 'Grade 1 passage sign: no contractions until the terminator',
  },
  grade1Terminator: {
    dots: [dotString('56'), dotString('3')],
    name: 'Grade 1 terminator: contractions resume',
  },
  numericContinuation: {
    dots: [dotString('5')],
    name: 'Continuation sign: the number continues on the next row',
  },
} as const;

export type IndicatorKey = keyof typeof INDICATORS;

export interface SymbolDef {
  dots: Dots[];
  name: string;
}

function sym(name: string, ...cells: string[]): SymbolDef {
  return { name, dots: cells.map(dotString) };
}

/**
 * Print punctuation and signs. Quotes and apostrophes are not here: which symbol they become
 * depends on context, so the translator picks from QUOTES.
 */
export const PUNCTUATION: Readonly<Record<string, SymbolDef>> = {
  ',': sym('comma', '2'),
  ';': sym('semicolon', '23'),
  ':': sym('colon', '25'),
  '.': sym('period', '256'),
  '!': sym('exclamation mark', '235'),
  '?': sym('question mark', '236'),
  '-': sym('hyphen', '36'),
  '‐': sym('hyphen', '36'),
  '–': sym('dash', '6', '36'),
  // UEB writes both print dashes as ⠠⠤; the long dash is for the two-em dash.
  '—': sym('dash', '6', '36'),
  '⸺': sym('long dash', '5', '6', '36'),
  '…': sym('ellipsis', '256', '256', '256'),
  '(': sym('opening parenthesis', '5', '126'),
  ')': sym('closing parenthesis', '5', '345'),
  '[': sym('opening square bracket', '46', '126'),
  ']': sym('closing square bracket', '46', '345'),
  '{': sym('opening curly bracket', '456', '126'),
  '}': sym('closing curly bracket', '456', '345'),
  '/': sym('slash', '456', '34'),
  '\\': sym('backslash', '456', '16'),
  '&': sym('ampersand', '4', '12346'),
  '@': sym('at sign', '4', '1'),
  '#': sym('number sign (hash)', '456', '1456'),
  '%': sym('percent', '46', '356'),
  '*': sym('asterisk', '5', '35'),
  $: sym('dollar', '4', '234'),
  '£': sym('pound sterling', '4', '123'),
  '€': sym('euro', '4', '15'),
  '¢': sym('cent', '4', '14'),
  '+': sym('plus', '5', '235'),
  '=': sym('equals', '5', '2356'),
  '<': sym('less than', '4', '126'),
  '>': sym('greater than', '4', '345'),
  '×': sym('multiplication sign', '5', '236'),
  '÷': sym('division sign', '5', '34'),
  '°': sym('degree', '45', '245'),
  _: sym('underscore', '46', '36'),
  '~': sym('tilde', '4', '35'),
  '^': sym('caret', '4', '26'),
  '|': sym('vertical bar', '456', '1256'),
  '©': sym('copyright', '45', '14'),
};

/** Multi-character print sequences that map to one braille symbol. Checked before single chars. */
export const SEQUENCES: Readonly<Record<string, SymbolDef>> = {
  '...': PUNCTUATION['…']!,
  '--': PUNCTUATION['–']!,
};

export const QUOTES = {
  apostrophe: sym('apostrophe', '3'),
  openDouble: sym('opening quotation mark', '236'),
  closeDouble: sym('closing quotation mark', '356'),
  openSingle: sym('opening single quotation mark', '6', '236'),
  closeSingle: sym('closing single quotation mark', '6', '356'),
} as const;

/** The print period and comma keep their shape inside numbers but read as part of the number. */
export const NUMERIC_PUNCTUATION: Readonly<Record<string, SymbolDef>> = {
  '.': sym('decimal point', '256'),
  ',': sym('comma (inside a number)', '2'),
};
