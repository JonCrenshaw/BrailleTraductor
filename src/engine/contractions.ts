// UEB Grade 2 contractions, used to explain cells on hover. The braille itself comes from liblouis,
// so a mistake or gap here only affects a label: unknown groups fall back to a generic description.
// Source: UEB Rulebook (2013) §10 (contractions) and Appendix 1 (shortforms list).

import { dotString, type Dots } from './cell';
import { LETTERS } from './symbols';

export type ContractionKind = 'wordsign' | 'groupsign' | 'shortform';

export interface Contraction {
  text: string;
  dots: Dots[];
  kind: ContractionKind;
}

const d = dotString;

/** Strong and lower groupsigns, usable inside words. */
const GROUP = {
  and: d('12346'),
  for: d('123456'),
  of: d('12356'),
  the: d('2346'),
  with: d('23456'),
  ch: d('16'),
  gh: d('126'),
  sh: d('146'),
  th: d('1456'),
  wh: d('156'),
  ed: d('1246'),
  er: d('12456'),
  ou: d('1256'),
  ow: d('246'),
  st: d('34'),
  ar: d('345'),
  ing: d('346'),
  ea: d('2'),
  be: d('23'),
  bb: d('23'),
  con: d('25'),
  cc: d('25'),
  dis: d('256'),
  en: d('26'),
  ff: d('235'),
  gg: d('2356'),
  in: d('35'),
} as const;

type Part = keyof typeof GROUP | string;

/** Spell a shortform from letters and groupsign names, e.g. ['ag', 'st'] for "against". */
function spell(...parts: Part[]): Dots[] {
  return parts.flatMap((p) =>
    p in GROUP ? [GROUP[p as keyof typeof GROUP]] : [...p].map((ch) => LETTERS[ch]!),
  );
}

const entries: Contraction[] = [];
const add = (kind: ContractionKind, text: string, dots: Dots[]) =>
  entries.push({ text, dots, kind });

// Alphabetic wordsigns (§10.1).
for (const [letter, word] of Object.entries({
  b: 'but',
  c: 'can',
  d: 'do',
  e: 'every',
  f: 'from',
  g: 'go',
  h: 'have',
  j: 'just',
  k: 'knowledge',
  l: 'like',
  m: 'more',
  n: 'not',
  p: 'people',
  q: 'quite',
  r: 'rather',
  s: 'so',
  t: 'that',
  u: 'us',
  v: 'very',
  w: 'will',
  x: 'it',
  y: 'you',
  z: 'as',
})) {
  add('wordsign', word, [LETTERS[letter]!]);
}

// Strong contractions, wordsigns and groupsigns (§10.2–10.4).
for (const t of ['and', 'for', 'of', 'the', 'with'] as const) add('groupsign', t, [GROUP[t]]);
add('wordsign', 'child', [GROUP.ch]);
add('wordsign', 'shall', [GROUP.sh]);
add('wordsign', 'this', [GROUP.th]);
add('wordsign', 'which', [GROUP.wh]);
add('wordsign', 'out', [GROUP.ou]);
add('wordsign', 'still', [GROUP.st]);
for (const t of [
  'ch',
  'gh',
  'sh',
  'th',
  'wh',
  'ed',
  'er',
  'ou',
  'ow',
  'st',
  'ar',
  'ing',
] as const) {
  add('groupsign', t, [GROUP[t]]);
}

// Lower wordsigns and groupsigns (§10.5–10.6).
add('wordsign', 'be', [GROUP.be]);
add('wordsign', 'enough', [GROUP.en]);
add('wordsign', 'were', [GROUP.gg]);
add('wordsign', 'his', [d('236')]);
add('wordsign', 'in', [GROUP.in]);
add('wordsign', 'was', [d('356')]);
for (const t of ['ea', 'be', 'bb', 'con', 'cc', 'dis', 'en', 'ff', 'gg', 'in'] as const) {
  add('groupsign', t, [GROUP[t]]);
}

// Initial-letter contractions (§10.7): a prefix cell plus the word's initial letter.
const initial = (prefix: string, words: Record<string, Dots>) => {
  for (const [word, last] of Object.entries(words)) add('groupsign', word, [d(prefix), last]);
};
initial('5', {
  day: LETTERS.d!,
  ever: LETTERS.e!,
  father: LETTERS.f!,
  here: LETTERS.h!,
  know: LETTERS.k!,
  lord: LETTERS.l!,
  mother: LETTERS.m!,
  name: LETTERS.n!,
  one: LETTERS.o!,
  part: LETTERS.p!,
  question: LETTERS.q!,
  right: LETTERS.r!,
  some: LETTERS.s!,
  time: LETTERS.t!,
  under: LETTERS.u!,
  work: LETTERS.w!,
  young: LETTERS.y!,
  there: GROUP.the,
  character: GROUP.ch,
  through: GROUP.th,
  where: GROUP.wh,
  ought: GROUP.ou,
});
initial('45', {
  upon: LETTERS.u!,
  word: LETTERS.w!,
  these: GROUP.the,
  those: GROUP.th,
  whose: GROUP.wh,
});
initial('456', {
  cannot: LETTERS.c!,
  had: LETTERS.h!,
  many: LETTERS.m!,
  spirit: LETTERS.s!,
  world: LETTERS.w!,
  their: GROUP.the,
});

// Final-letter groupsigns (§10.8).
const final = (prefix: string, groups: Record<string, string>) => {
  for (const [text, letter] of Object.entries(groups)) {
    add('groupsign', text, [d(prefix), LETTERS[letter]!]);
  }
};
final('46', { ound: 'd', ance: 'e', sion: 'n', less: 's', ount: 't' });
final('56', { ence: 'e', ong: 'g', ful: 'l', tion: 'n', ness: 's', ment: 't', ity: 'y' });
final('6', { ation: 'n', ally: 'y' });

// Shortforms (§10.9, Appendix 1).
const SHORTFORMS: Record<string, Part[]> = {
  about: ['ab'],
  above: ['abv'],
  according: ['ac'],
  across: ['acr'],
  after: ['af'],
  afternoon: ['afn'],
  afterward: ['afw'],
  again: ['ag'],
  against: ['ag', 'st'],
  almost: ['alm'],
  already: ['alr'],
  also: ['al'],
  although: ['al', 'th'],
  altogether: ['alt'],
  always: ['alw'],
  because: ['be', 'c'],
  before: ['be', 'f'],
  behind: ['be', 'h'],
  below: ['be', 'l'],
  beneath: ['be', 'n'],
  beside: ['be', 's'],
  between: ['be', 't'],
  beyond: ['be', 'y'],
  blind: ['bl'],
  braille: ['brl'],
  children: ['ch', 'n'],
  conceive: ['con', 'cv'],
  conceiving: ['con', 'cvg'],
  could: ['cd'],
  deceive: ['dcv'],
  deceiving: ['dcvg'],
  declare: ['dcl'],
  declaring: ['dclg'],
  either: ['ei'],
  first: ['f', 'st'],
  friend: ['fr'],
  good: ['gd'],
  great: ['grt'],
  herself: ['h', 'er', 'f'],
  him: ['hm'],
  himself: ['hmf'],
  immediate: ['imm'],
  its: ['xs'],
  itself: ['xf'],
  letter: ['lr'],
  little: ['ll'],
  much: ['m', 'ch'],
  must: ['m', 'st'],
  myself: ['myf'],
  necessary: ['nec'],
  neither: ['nei'],
  paid: ['pd'],
  perceive: ['p', 'er', 'cv'],
  perceiving: ['p', 'er', 'cvg'],
  perhaps: ['p', 'er', 'h'],
  quick: ['qk'],
  receive: ['rcv'],
  receiving: ['rcvg'],
  rejoice: ['rjc'],
  rejoicing: ['rjcg'],
  said: ['sd'],
  should: ['sh', 'd'],
  such: ['s', 'ch'],
  themselves: ['the', 'mvs'],
  thyself: ['th', 'yf'],
  today: ['td'],
  together: ['tgr'],
  tomorrow: ['tm'],
  tonight: ['tn'],
  would: ['wd'],
  your: ['yr'],
  yourself: ['yrf'],
  yourselves: ['yrvs'],
};
for (const [word, parts] of Object.entries(SHORTFORMS)) add('shortform', word, spell(...parts));
add('shortform', 'oneself', [d('5'), LETTERS.o!, LETTERS.f!]);
add('shortform', 'ourselves', [GROUP.ou, LETTERS.r!, LETTERS.v!, LETTERS.s!]);

export const CONTRACTIONS: readonly Contraction[] = entries;

const byText = new Map<string, Contraction[]>();
for (const c of entries) byText.set(c.text, [...(byText.get(c.text) ?? []), c]);

/** The contraction for `text` written as exactly these cells, if there is one. */
export function findContraction(text: string, cells: readonly Dots[]): Contraction | undefined {
  return byText
    .get(text.toLowerCase())
    ?.find((c) => c.dots.length === cells.length && c.dots.every((v, i) => v === cells[i]));
}
