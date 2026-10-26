import { describe, expect, it } from 'vitest';
// Expected braille comes from the UEB Rulebook (2013) and BANA's "ABCs of UEB" examples.
import { toUnicode } from '../../src/engine/cell';
import { translate } from '../../src/engine/translate';

/** Translate to Unicode braille, words separated by spaces and paragraphs by newlines. */
function brl(text: string): string {
  return translate(text)
    .paragraphs.map((p) => p.map((w) => w.cells.map((c) => toUnicode(c.dots)).join('')).join(' '))
    .join('\n');
}

describe('letters', () => {
  it('translates the alphabet', () => {
    expect(brl('abcdefghijklmnopqrstuvwxyz')).toBe('⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵');
  });

  it('translates a plain word', () => {
    expect(brl('gorgeous')).toBe('⠛⠕⠗⠛⠑⠕⠥⠎');
  });
});

describe('capitals', () => {
  it.each([
    ['Hello', '⠠⠓⠑⠇⠇⠕'],
    ['I am', '⠠⠊ ⠁⠍'],
    ['NASA', '⠠⠠⠝⠁⠎⠁'],
    ['McDonald', '⠠⠍⠉⠠⠙⠕⠝⠁⠇⠙'],
    // Lowercase after capitals in the same letter run needs the capitals terminator.
    ['CDs', '⠠⠠⠉⠙⠠⠄⠎'],
    // An apostrophe or hyphen ends capital-word mode, so no terminator is needed.
    ["BOB's", '⠠⠠⠃⠕⠃⠄⠎'],
    ['SALT-WATER', '⠠⠠⠎⠁⠇⠞⠤⠠⠠⠺⠁⠞⠑⠗'],
  ])('%s', (input, expected) => {
    expect(brl(input)).toBe(expected);
  });

  it('uses a capitals passage for three or more capitalized words', () => {
    // The terminator goes after the last word, punctuation included.
    expect(brl('HAPPY BIRTHDAY TO YOU!')).toBe('⠠⠠⠠⠓⠁⠏⠏⠽ ⠃⠊⠗⠞⠓⠙⠁⠽ ⠞⠕ ⠽⠕⠥⠖⠠⠄');
  });

  it('uses word indicators for only two capitalized words', () => {
    expect(brl('OH NO')).toBe('⠠⠠⠕⠓ ⠠⠠⠝⠕');
  });
});

describe('numbers', () => {
  it.each([
    ['42', '⠼⠙⠃'],
    ['1234567890', '⠼⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚'],
    ['3.14', '⠼⠉⠲⠁⠙'],
    ['1,000', '⠼⠁⠂⠚⠚⠚'],
    // a–j after a digit would read as more digits, so they take the Grade 1 sign.
    ['4a', '⠼⠙⠰⠁'],
    ['4k', '⠼⠙⠅'],
    // A capital sign ends numeric mode on its own.
    ['3D', '⠼⠉⠠⠙'],
    // A hyphen ends numeric mode, so the second number needs its own number sign.
    ['555-1234', '⠼⠑⠑⠑⠤⠼⠁⠃⠉⠙'],
    ['I have 2 cats.', '⠠⠊ ⠓⠁⠧⠑ ⠼⠃ ⠉⠁⠞⠎⠲'],
    ['5.', '⠼⠑⠲'],
  ])('%s', (input, expected) => {
    expect(brl(input)).toBe(expected);
  });
});

describe('punctuation', () => {
  it.each([
    ['Hi, Bob.', '⠠⠓⠊⠂ ⠠⠃⠕⠃⠲'],
    ['Why? Now!', '⠠⠺⠓⠽⠦ ⠠⠝⠕⠺⠖'],
    ['a; b: c', '⠁⠆ ⠃⠒ ⠉'],
    ["don't", '⠙⠕⠝⠄⠞'],
    ['don’t', '⠙⠕⠝⠄⠞'],
    ['"Hi," she said.', '⠦⠠⠓⠊⠂⠴ ⠎⠓⠑ ⠎⠁⠊⠙⠲'],
    ['“Hi”', '⠦⠠⠓⠊⠴'],
    // Straight single quotes are apostrophes; curly ones are quotation marks.
    ["'yes'", '⠄⠽⠑⠎⠄'],
    ["'90s", '⠄⠼⠊⠚⠎'],
    ['‘no’', '⠠⠦⠝⠕⠠⠴'],
    ["the dogs' bowls", '⠞⠓⠑ ⠙⠕⠛⠎⠄ ⠃⠕⠺⠇⠎'],
    ['(wow)', '⠐⠣⠺⠕⠺⠐⠜'],
    ['[x]', '⠨⠣⠭⠨⠜'],
    ['wait...', '⠺⠁⠊⠞⠲⠲⠲'],
    ['wait…', '⠺⠁⠊⠞⠲⠲⠲'],
    ['yes--no', '⠽⠑⠎⠠⠤⠝⠕'],
    ['yes—no', '⠽⠑⠎⠠⠤⠝⠕'],
    ['yes⸺no', '⠽⠑⠎⠐⠠⠤⠝⠕'],
    ['and/or', '⠁⠝⠙⠸⠌⠕⠗'],
    ['me@x', '⠍⠑⠈⠁⠭'],
    ['$5', '⠈⠎⠼⠑'],
    ['50%', '⠼⠑⠚⠨⠴'],
    ['#1', '⠸⠹⠼⠁'],
    ['A&B', '⠠⠁⠈⠯⠠⠃'],
  ])('%s', (input, expected) => {
    expect(brl(input)).toBe(expected);
  });
});

describe('text structure', () => {
  it('collapses repeated spaces and keeps line breaks as paragraphs', () => {
    expect(brl('hi   there\r\nbye')).toBe('⠓⠊ ⠞⠓⠑⠗⠑\n⠃⠽⠑');
  });

  it('keeps blank lines but drops trailing ones', () => {
    expect(brl('a\n\nb\n\n')).toBe('⠁\n\n⠃');
  });

  it('returns no paragraphs for empty input', () => {
    expect(translate('   ').paragraphs).toEqual([]);
  });
});

describe('unsupported input', () => {
  it('drops accents with a warning', () => {
    const t = translate('café');
    expect(brl('café')).toBe('⠉⠁⠋⠑');
    expect(t.warnings).toEqual(['Accent dropped: "é" written as "e".']);
  });

  it('leaves out symbols with no braille equivalent', () => {
    const t = translate('a☃b ☃');
    expect(brl('a☃b ☃')).toBe('⠁⠃');
    expect(t.warnings).toEqual(['No braille symbol for "☃"; it was left out.']);
  });

  it('rejects grades that are not available yet', () => {
    expect(() => translate('hi', 2)).toThrow(/not available/);
  });
});

describe('cell descriptions', () => {
  it('describes what each cell means', () => {
    const cells = translate('A1').paragraphs[0]![0]!.cells;
    expect(cells.map((c) => [c.kind, c.print, c.name])).toEqual([
      ['indicator', '', 'Capital sign: the next letter is uppercase'],
      ['letter', 'A', 'letter a (uppercase A)'],
      ['indicator', '', 'Number sign: the following letters a–j are digits 1–0'],
      ['digit', '1', 'digit 1'],
    ]);
  });

  it('numbers the cells of multi-cell symbols', () => {
    const cells = translate('(').paragraphs[0]![0]!.cells;
    expect(cells.map((c) => c.name)).toEqual([
      'opening parenthesis (cell 1 of 2)',
      'opening parenthesis (cell 2 of 2)',
    ]);
  });
});
