// Cross-checks our hand-written Grade 1 against liblouis's en-ueb-g1.ctb. Any difference is either
// a bug here or a deliberate choice listed in DELIBERATE below.
import { describe, expect, it } from 'vitest';
import { toUnicode } from '../../src/engine/cell';
import { louTranslate } from '../../src/engine/liblouis';
import { translate } from '../../src/engine/translate';
import { loadLiblouis } from './load-liblouis';

const SAMPLES = [
  'Hello, World!',
  'gorgeous',
  'HAPPY BIRTHDAY TO YOU!',
  'MY NAME IS JON',
  'OH NO',
  'NASA',
  'McDonald',
  'iPhone',
  'CDs',
  "BOB's",
  'SALT-WATER',
  'COVID-19',
  'R2-D2',
  '42',
  '3.14',
  '1,000',
  '4a',
  '4k',
  '3D',
  'x2',
  'X2',
  'ABC123',
  'abc123def',
  '555-1234',
  'I have 2 cats.',
  'It is 12:00.',
  'Meet me at 3:30, OK?',
  'The year 1999-2000',
  'Is it 50/50?',
  '5.',
  'Why? Now!',
  'a; b: c',
  "don't",
  "'yes'",
  '"Hi," she said.',
  '“Hi”',
  'He said "WOW" loudly',
  "the dogs' bowls",
  '(wow)',
  '[x]',
  '{a}',
  'wait...',
  'wait…',
  'yes—no',
  'and/or',
  'me@x',
  '$5',
  '50%',
  '#1',
  'A&B',
  'x+y=z',
  '3 < 4 > 2',
  '£5 €6 ¢7',
  '90°',
  'a_b',
  '~ok',
  'a^b',
  'a|b',
  'one*two',
  '©2026',
];

/** Where we intentionally differ from liblouis, and why. */
const DELIBERATE: Record<string, string> = {
  // A typed "--" almost always means a dash; liblouis writes two hyphens.
  'yes--no': '⠽⠑⠎⠠⠤⠝⠕',
  // UEB has a backslash symbol (⠸⠡); liblouis's Grade 1 table doesn't define one.
  'a\\b': '⠁⠸⠡⠃',
};

function ours(text: string): string {
  return translate(text)
    .paragraphs.flat()
    .map((w) => w.cells.map((c) => toUnicode(c.dots)).join(''))
    .join('⠀');
}

describe('Grade 1 matches liblouis en-ueb-g1', () => {
  it.each(SAMPLES)('%s', async (text) => {
    const lou = await loadLiblouis();
    const theirs = louTranslate(lou, '/tables/en-ueb-g1.ctb', text).cells.map(toUnicode).join('');
    expect(ours(text)).toBe(theirs);
  });

  it.each(Object.entries(DELIBERATE))('differs on purpose: %s', (text, expected) => {
    expect(ours(text)).toBe(expected);
  });
});
