// Grade 2 braille comes from liblouis (en-ueb-g2.ctb). These tests pin its output for common cases
// and check our explanations and layout markings. Expected braille follows the UEB Rulebook (2013)
// §10 (contractions) and Appendix 1 (shortforms).
import { beforeAll, describe, expect, it } from 'vitest';
import { toUnicode } from '../../src/engine/cell';
import { createGrade2 } from '../../src/engine/grade2';
import { layout, usedLength } from '../../src/engine/layout';
import { liblouisVersion } from '../../src/engine/liblouis';
import { registerTranslator, translate } from '../../src/engine/translate';
import { loadLiblouis } from './load-liblouis';

beforeAll(async () => {
  registerTranslator(createGrade2(await loadLiblouis()));
});

function brl(text: string): string {
  return translate(text, 2)
    .paragraphs.map((p) => p.map((w) => w.cells.map((c) => toUnicode(c.dots)).join('')).join(' '))
    .join('\n');
}

function names(text: string): string[] {
  return translate(text, 2)
    .paragraphs.flat()
    .flatMap((w) => w.cells.map((c) => c.name));
}

describe('liblouis', () => {
  it('is the pinned version', async () => {
    expect(liblouisVersion(await loadLiblouis())).toBe('3.39.0');
  });

  it('refuses to start if the tables are missing', async () => {
    const lou = await loadLiblouis();
    // Simulate missing tables: every translation comes back as an escape sequence.
    const broken = { ...lou, _lou_translate: () => 0 } as typeof lou;
    expect(() => createGrade2(broken)).toThrow();
  });
});

describe('contractions', () => {
  it.each([
    // Strong contractions (§10.3)
    ['the', '⠮'],
    ['and', '⠯'],
    ['for the', '⠿ ⠮'],
    // Alphabetic wordsigns (§10.1)
    ['knowledge', '⠅'],
    ['people', '⠏'],
    ['you', '⠽'],
    // Lower wordsigns (§10.5)
    ['in', '⠔'],
    ['enough', '⠢'],
    ['were', '⠶'],
    ['his', '⠦'],
    ['was', '⠴'],
    ['be', '⠆'],
    // Initial-letter contractions (§10.7)
    ['mother', '⠐⠍'],
    ['question', '⠐⠟'],
    ['ought', '⠐⠳'],
    ['cannot', '⠸⠉'],
    ['world', '⠸⠺'],
    // Groupsigns inside words (§10.4, §10.6, §10.8)
    ['something', '⠐⠎⠹⠬'],
    ['everything', '⠐⠑⠽⠹⠬'],
    ['nation', '⠝⠁⠰⠝'],
    ['gorgeous', '⠛⠕⠗⠛⠑⠳⠎'],
    ['Wednesday', '⠠⠺⠫⠝⠑⠎⠐⠙'],
    // Shortforms (§10.9)
    ['children', '⠡⠝'],
    ['said', '⠎⠙'],
    ['friend', '⠋⠗'],
    ['about', '⠁⠃'],
    ['beneath', '⠆⠝'],
    ['today', '⠞⠙'],
    ['braille', '⠃⠗⠇'],
    ['good', '⠛⠙'],
    ["can't", '⠉⠄⠞'],
  ])('%s', (input, expected) => {
    expect(brl(input)).toBe(expected);
  });
});

describe('indicators in Grade 2', () => {
  it.each([
    ['The', '⠠⠮'],
    // A letter standing alone that is also a wordsign takes the Grade 1 sign (§5.7).
    ['a b c', '⠁ ⠰⠃ ⠰⠉'],
    ['HAPPY BIRTHDAY TO YOU!', '⠠⠠⠠⠓⠁⠏⠏⠽ ⠃⠊⠗⠹⠐⠙ ⠞⠕ ⠽⠖⠠⠄'],
    ['I have 2 cats.', '⠠⠊ ⠓ ⠼⠃ ⠉⠁⠞⠎⠲'],
    ['Meet me at 3:30, OK?', '⠠⠍⠑⠑⠞ ⠍⠑ ⠁⠞ ⠼⠉⠒⠼⠉⠚⠂ ⠠⠠⠕⠅⠦'],
  ])('%s', (input, expected) => {
    expect(brl(input)).toBe(expected);
  });

  it('writes a typed double hyphen as a dash, like Grade 1', () => {
    expect(brl('yes--no')).toBe('⠽⠑⠎⠠⠤⠝⠕');
  });

  it('keeps line breaks as paragraphs', () => {
    expect(brl('the\n\nand')).toBe('⠮\n\n⠯');
  });
});

describe('explanations', () => {
  it('names contractions and shortforms', () => {
    expect(names('The children')).toEqual([
      'Capital sign: the next letter is uppercase',
      'contraction for "the"',
      'shortform (abbreviated word) for "children" (cell 1 of 2)',
      'shortform (abbreviated word) for "children" (cell 2 of 2)',
    ]);
    expect(names('knowledge')).toEqual(['contraction (whole word) for "knowledge"']);
  });

  it('names letters, digits, numeric punctuation and indicators', () => {
    expect(names('b 3.5')).toEqual([
      'Grade 1 sign: the next cell is a plain letter, not a contraction or digit',
      'letter b',
      'Number sign: the following letters a–j are digits 1–0',
      'digit 3',
      'decimal point',
      'digit 5',
    ]);
  });

  it('names quotes, multi-cell punctuation and accents', () => {
    expect(names('"(café)"')).toEqual([
      'opening quotation mark',
      'opening parenthesis (cell 1 of 2)',
      'opening parenthesis (cell 2 of 2)',
      'letter c',
      'letter a',
      'letter f',
      'accent sign for "é" (cell 1 of 2)',
      'accent sign for "é" (cell 2 of 2)',
      'letter e, with the accent',
      'closing parenthesis (cell 1 of 2)',
      'closing parenthesis (cell 2 of 2)',
      'closing quotation mark',
    ]);
  });

  it('attaches the capitals terminator to the word before it', () => {
    const words = translate('CDs YES', 2).paragraphs[0]!;
    expect(words.map((w) => w.print)).toEqual(['CDs', 'YES']);
    expect(words[0]!.cells.map((c) => c.name)).toEqual([
      'Capital word sign: the following letters are uppercase',
      'Capital word sign: the following letters are uppercase',
      'letter c (uppercase C)',
      'letter d (uppercase D)',
      'Capitals terminator: uppercase ends here',
      'Capitals terminator: uppercase ends here',
      'letter s',
    ]);
  });

  it('falls back to a plain description for anything it cannot explain', () => {
    // A ligature liblouis writes as two letters: no single-character rule explains it.
    const cells = translate('ﬁ', 2).paragraphs.flat()[0]?.cells ?? [];
    for (const c of cells) expect(c.name).toMatch(/^braille for "ﬁ"|letter/);
  });

  it('leaves out characters liblouis has no rule for, with a warning', () => {
    const t = translate('a☃b ☃', 2);
    expect(t.warnings).toEqual(['No braille symbol for "☃"; it was left out.']);
    expect(t.paragraphs[0]!.map((w) => w.print)).toEqual(['ab']);
  });
});

describe('layout markings', () => {
  it('keeps the cells of a contraction together', () => {
    const cells = translate('ought', 2).paragraphs[0]![0]!.cells;
    expect(cells.map((c) => c.joinNext ?? false)).toEqual([true, false]);
  });

  it('marks capital-word and numeric modes so row breaks can continue them', () => {
    const words = translate('NASA 1234', 2).paragraphs[0]!;
    expect(words[0]!.cells.filter((c) => c.kind === 'letter').map((c) => c.mode)).toEqual([
      'capitals',
      'capitals',
      'capitals',
      'capitals',
    ]);
    expect(
      words[1]!.cells.filter((c) => c.kind === 'digit').every((c) => c.mode === 'numeric'),
    ).toBe(true);
  });

  it('never ends a row inside a contraction', () => {
    const slate = layout(translate('Something everywhere questionable', 2), 5);
    for (const row of slate.pages[0]!) {
      const used = row.slice(0, usedLength(row));
      expect(used.at(-1)?.joinNext ?? false).toBe(false);
    }
  });
});
