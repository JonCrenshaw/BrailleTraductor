// Unified English Braille, Grade 2 (contracted), translated by liblouis (en-ueb-g2.ctb), the
// reference open-source braille translator. liblouis supplies the cells; this file works out what
// each cell means so the UI can explain it, and marks cells layout must keep together.
//
// liblouis reports, for every output cell, which input character it came from. Cells from the same
// character form a group: indicators share the position of the letter they modify, a contraction
// sits at the first letter it replaces, and a capitals terminator sits at the last capital.

import type { Dots } from './cell';
import { findContraction, type ContractionKind } from './contractions';
import { louTranslate, type LiblouisModule } from './liblouis';
import {
  DIGITS,
  INDICATORS,
  LETTERS,
  NUMERIC_PUNCTUATION,
  PUNCTUATION,
  QUOTES,
  type IndicatorKey,
  type SymbolDef,
} from './symbols';
import type { BrailleCell, BrailleWord, Paragraph, Translator } from './types';

const TABLE = '/tables/en-ueb-g2.ctb';

type Mode = 'capitals' | 'numeric';

interface Group {
  /** The print text this group came from. */
  text: string;
  cells: Dots[];
}

interface Named {
  name: string;
  kind: BrailleCell['kind'];
  print: string;
}

const sameDots = (a: readonly Dots[], b: readonly Dots[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// Prefix indicators, longest first so ⠠⠠⠠ isn't read as ⠠ + ⠠⠠.
const PREFIXES: IndicatorKey[] = [
  'capitalPassage',
  'grade1Passage',
  'capitalWord',
  'grade1Word',
  'capitalLetter',
  'grade1',
  'numeric',
];
const TERMINATORS: IndicatorKey[] = ['capitalTerminator', 'grade1Terminator'];

const GRADE1_SIGN_NAME =
  'Grade 1 sign: the next cell is a plain letter, not a contraction or digit';

function indicatorName(key: IndicatorKey): string {
  return key === 'grade1' ? GRADE1_SIGN_NAME : INDICATORS[key].name;
}

/** Split cells into a sequence of indicators, or return null if they aren't all indicators. */
function parseIndicators(cells: Dots[]): IndicatorKey[] | null {
  const keys: IndicatorKey[] = [];
  let i = 0;
  while (i < cells.length) {
    const key = PREFIXES.find((k) => {
      const dots = INDICATORS[k].dots;
      return sameDots(cells.slice(i, i + dots.length), dots);
    });
    if (!key) return null;
    keys.push(key);
    i += INDICATORS[key].dots.length;
  }
  return keys;
}

function endingTerminator(cells: Dots[]): IndicatorKey | undefined {
  return TERMINATORS.find((k) => {
    const dots = INDICATORS[k].dots;
    return cells.length > dots.length && sameDots(cells.slice(-dots.length), dots);
  });
}

const QUOTE_CHARS = `'"‘’“”`;

/** Print symbols a character could be written as. Quotes depend on context, so try them all. */
function symbolsFor(ch: string): SymbolDef[] {
  const defs: SymbolDef[] = [];
  if (PUNCTUATION[ch]) defs.push(PUNCTUATION[ch]);
  if (QUOTE_CHARS.includes(ch)) defs.push(...Object.values(QUOTES));
  return defs;
}

/** The plain letter under an accent, e.g. "e" for "é", or undefined if it isn't one. */
function accentBase(ch: string): string | undefined {
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return base !== ch && base.length === 1 && LETTERS[base.toLowerCase()] ? base : undefined;
}

function charName(ch: string): string {
  const lower = ch.toLowerCase();
  return ch === lower ? `letter ${lower}` : `letter ${lower} (uppercase ${ch})`;
}

const CONTRACTION_LABEL: Record<ContractionKind, string> = {
  wordsign: 'contraction (whole word)',
  groupsign: 'contraction',
  shortform: 'shortform (abbreviated word)',
};

function numbered(name: string, i: number, n: number): string {
  return n > 1 ? `${name} (cell ${i + 1} of ${n})` : name;
}

/** Name the content cells of a group, or return null if we can't explain them. */
function nameContent(text: string, cells: Dots[]): Named[] | null {
  if (cells.length === 0) return null;

  const contraction = findContraction(text, cells);
  if (contraction) {
    const label = `${CONTRACTION_LABEL[contraction.kind]} for "${contraction.text}"`;
    return cells.map((_, i) => ({
      name: numbered(label, i, cells.length),
      kind: 'contraction',
      print: text,
    }));
  }

  const chars = [...text];
  // Spelled out one cell per character.
  if (chars.length === cells.length) {
    const named: Named[] = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]!;
      const lower = ch.toLowerCase();
      if (LETTERS[lower] === cells[i]) {
        named.push({ name: charName(ch), kind: 'letter', print: ch });
      } else if (DIGITS[ch] === cells[i]) {
        named.push({ name: `digit ${ch}`, kind: 'digit', print: ch });
      } else {
        const def = symbolsFor(ch).find((s) => sameDots(s.dots, [cells[i]!]));
        if (!def) return null;
        named.push({ name: def.name, kind: 'punctuation', print: ch });
      }
    }
    return named;
  }

  // An accented letter: a two-cell accent sign, then the letter (UEB §4.2).
  const base = chars.length === 1 ? accentBase(text) : undefined;
  if (base && cells.length === 3 && cells[2] === LETTERS[base.toLowerCase()]) {
    return [
      { name: `accent sign for "${text}" (cell 1 of 2)`, kind: 'indicator', print: text },
      { name: `accent sign for "${text}" (cell 2 of 2)`, kind: 'indicator', print: text },
      { name: `${charName(base)}, with the accent`, kind: 'letter', print: text },
    ];
  }

  // One print symbol written with several cells.
  if (chars.length === 1) {
    const def = symbolsFor(text).find((s) => sameDots(s.dots, cells));
    if (def) {
      return cells.map((_, i) => ({
        name: numbered(def.name, i, cells.length),
        kind: 'punctuation',
        print: text,
      }));
    }
  }
  return null;
}

interface Explained {
  prefix: IndicatorKey[];
  content: Named[];
  suffix: IndicatorKey | undefined;
}

/** Explain a group as [indicators][content][terminator], trying the shortest prefix first. */
function explain(group: Group): Explained | null {
  const term = endingTerminator(group.cells);
  const suffixOptions: (IndicatorKey | undefined)[] = term ? [undefined, term] : [undefined];
  for (const suffix of suffixOptions) {
    const end = group.cells.length - (suffix ? INDICATORS[suffix].dots.length : 0);
    for (let i = 0; i < end; i++) {
      const prefix = parseIndicators(group.cells.slice(0, i));
      if (!prefix) continue;
      const content = nameContent(group.text, group.cells.slice(i, end));
      if (content) return { prefix, content, suffix };
    }
  }
  return null;
}

/** Group output cells by the input character they came from. */
function groupCells(text: string, cells: Dots[], inputPos: number[]): Group[] {
  const chars = [...text];
  const starts: { start: number; cells: Dots[] }[] = [];
  cells.forEach((cell, i) => {
    const pos = inputPos[i]!;
    const last = starts.at(-1);
    if (last && last.start === pos) last.cells.push(cell);
    else starts.push({ start: pos, cells: [cell] });
  });

  const groups: (Group & { start: number; end: number })[] = [];
  starts.forEach((g, i) => {
    const end = Math.max(g.start + 1, starts[i + 1]?.start ?? chars.length);
    const isTerminatorOnly = TERMINATORS.some((k) => sameDots(g.cells, INDICATORS[k].dots));
    const prev = groups.at(-1);
    if (isTerminatorOnly && prev) {
      // A terminator is reported at the last capital, which belongs to the group before it.
      prev.cells.push(...g.cells);
      prev.end = end;
      prev.text = chars.slice(prev.start, end).join('');
      return;
    }
    groups.push({ start: g.start, end, cells: g.cells, text: chars.slice(g.start, end).join('') });
  });
  return groups;
}

/** Build the explained, layout-ready cells for one word's groups. */
function wordCells(groups: Group[]): BrailleCell[] {
  const out: BrailleCell[] = [];
  let mode: Mode | null = null;

  for (const group of groups) {
    const start = out.length;
    const ex = explain(group);
    if (!ex) {
      group.cells.forEach((dots, i) => {
        out.push({
          dots,
          kind: 'contraction',
          print: group.text,
          name: numbered(`braille for "${group.text}"`, i, group.cells.length),
        });
      });
      mode = null;
    } else {
      if (ex.prefix.includes('capitalWord')) mode = 'capitals';
      else if (ex.prefix.includes('numeric')) mode = 'numeric';
      else if (ex.prefix.length > 0) mode = null;

      let i = 0;
      for (const key of ex.prefix) {
        for (const dots of INDICATORS[key].dots) {
          out.push({ dots, kind: 'indicator', print: '', name: indicatorName(key) });
          i++;
        }
      }
      for (const named of ex.content) {
        const cell: BrailleCell = { dots: group.cells[i++]!, ...named };
        const continues =
          (mode === 'capitals' && named.kind !== 'punctuation' && named.kind !== 'digit') ||
          (mode === 'numeric' && (named.kind === 'digit' || /^[.,]$/.test(named.print)));
        if (continues && mode) {
          cell.mode = mode;
          const numericName = mode === 'numeric' && NUMERIC_PUNCTUATION[named.print];
          if (numericName) cell.name = numericName.name;
        } else {
          mode = null;
        }
        out.push(cell);
      }
      if (ex.suffix) {
        for (const dots of INDICATORS[ex.suffix].dots) {
          out.push({ dots, kind: 'indicator', print: '', name: indicatorName(ex.suffix) });
        }
        mode = null;
      }
    }
    // Never break inside a group: keep every cell but the last with the next one.
    for (let k = start; k < out.length - 1; k++) out[k]!.joinNext = true;
  }
  return out;
}

/** liblouis writes characters it has no rule for as an escape like '\x2603'. */
function isEscape(cells: Dots[]): boolean {
  return cells.length >= 6 && sameDots(cells.slice(0, 3), [0b000100, 0b110011, 0b101101]);
}

export function createGrade2(lou: LiblouisModule): Translator {
  // If the table data didn't load, liblouis escapes every character instead of failing.
  if (!sameDots(louTranslate(lou, TABLE, 'the').cells, [0b101110])) {
    throw new Error('liblouis loaded, but its Grade 2 tables did not.');
  }

  const supported = new Map<string, boolean>();
  const isSupported = (ch: string) => {
    let ok = supported.get(ch);
    if (ok === undefined) {
      ok = /\s/.test(ch) || !isEscape(louTranslate(lou, TABLE, ch).cells);
      supported.set(ch, ok);
    }
    return ok;
  };

  return {
    grade: 2,
    label: 'Grade 2 (contracted)',
    translateParagraph(rawWords, warnings): Paragraph {
      const words = rawWords
        .map((word) =>
          [...word]
            .filter((ch) => {
              if (isSupported(ch)) return true;
              warnings.add(`No braille symbol for "${ch}"; it was left out.`);
              return false;
            })
            .join(''),
        )
        .filter((w) => w !== '');
      if (words.length === 0) return [];

      // A typed "--" means a dash, as in Grade 1; liblouis would write two hyphens.
      const text = words.join(' ').replaceAll('--', '–');
      const raw = louTranslate(lou, TABLE, text);
      const groups = groupCells(text, raw.cells, raw.inputPos);

      // Blank cells that come from spaces separate words. liblouis keeps every space, so this
      // normally gives back the input words; joined words would simply stay together.
      const paragraph: BrailleWord[] = [];
      let current: Group[] = [];
      const finish = () => {
        if (current.length === 0) return;
        paragraph.push({ print: current.map((g) => g.text).join(''), cells: wordCells(current) });
        current = [];
      };
      for (const g of groups) {
        if (/^\s+$/.test(g.text) && g.cells.every((c) => c === 0)) finish();
        else current.push(g);
      }
      finish();
      return paragraph;
    },
  };
}
