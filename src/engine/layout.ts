// Lays translated braille out on a slate: a fixed number of cells per row and, optionally, rows per
// page. Rows are built in reading order (how the finished page is read, left to right). The writing
// view is derived from that: on the back of the paper each row runs right to left and each cell is
// mirrored, so the reader's left margin is the writer's right edge.

import { mirror, type Dots } from './cell';
import { INDICATORS, PUNCTUATION } from './symbols';
import type { BrailleCell, Translation } from './types';

/** A row is exactly `cellsPerRow` slots; null is an empty cell. */
export type Row = (BrailleCell | null)[];

export interface SlateLayout {
  cellsPerRow: number;
  rowsPerPage: number | null;
  pages: Row[][];
  /** Notes about wrapping, such as words that had to be split across rows. */
  warnings: string[];
}

export interface WritingSlot {
  cell: BrailleCell | null;
  /** The dots to punch from the back (mirrored). 0 for an empty slot. */
  writeDots: Dots;
  /** Position of this slot in the finished, reading-order row (0 = reader's left margin). */
  readingIndex: number;
}

const CONTINUATION_HYPHEN: BrailleCell = {
  dots: PUNCTUATION['-']!.dots[0]!,
  kind: 'punctuation',
  print: '-',
  name: 'hyphen: the word continues on the next row',
};

// UEB §6.10: a number divided between rows ends the row with the continuation sign (dot 5), and
// the number sign is not repeated on the next row.
const NUMBER_CONTINUATION: BrailleCell = {
  dots: INDICATORS.numericContinuation.dots[0],
  kind: 'indicator',
  print: '',
  name: INDICATORS.numericContinuation.name,
};

// A row break ends capital-word mode like a hyphen does, so the sign is repeated on the next row.
const REPEATED_CAPITAL_WORD: BrailleCell[] = INDICATORS.capitalWord.dots.map((dots) => ({
  dots,
  kind: 'indicator',
  print: '',
  name: `${INDICATORS.capitalWord.name} (repeated after the row break)`,
  joinNext: true,
}));

/** Marker for the blank cell between words; rendered as an empty slot. */
const SPACE: BrailleCell = { dots: 0, kind: 'punctuation', print: ' ', name: 'space' };

export const MIN_CELLS_PER_ROW = 4;

function pad(cells: BrailleCell[], width: number): Row {
  return [...cells, ...Array<null>(width - cells.length).fill(null)];
}

const isPrintHyphen = (c: BrailleCell) => c.kind === 'punctuation' && '-‐–—'.includes(c.print);

const content = (cells: BrailleCell[], from: number, to = cells.length) =>
  cells.slice(from, to).filter((c) => c.kind !== 'indicator').length;

interface Split {
  /** Cells for the current row, including any added hyphen or continuation sign. */
  head: BrailleCell[];
  /** Cells carried to the next row, including any repeated indicator. */
  tail: BrailleCell[];
}

/**
 * Find the best place to divide a word so the first part fits in `room` cells. In order of
 * preference: right after a hyphen or dash already in the word (nothing added); otherwise as late
 * as possible, adding a hyphen (or the number continuation sign inside a number). Never separates
 * an indicator from the cell it modifies, or the cells of one symbol, unless nothing else fits.
 */
function findSplit(cells: BrailleCell[], room: number, strict: boolean): Split | null {
  const candidates: (Split & { natural: boolean; size: number })[] = [];
  for (let k = 1; k < cells.length; k++) {
    const before = cells[k - 1]!;
    const after = cells[k]!;
    // Keep at least two real characters (not indicators) on each side of the break.
    if (strict && (before.joinNext || content(cells, 0, k) < 2 || content(cells, k) < 2)) continue;
    const rest = cells.slice(k);

    if (isPrintHyphen(before)) {
      candidates.push({ head: cells.slice(0, k), tail: rest, natural: true, size: k });
    } else if (before.mode === 'numeric' && after.mode === 'numeric') {
      candidates.push({
        head: [...cells.slice(0, k), NUMBER_CONTINUATION],
        tail: rest,
        natural: false,
        size: k + 1,
      });
    } else {
      candidates.push({
        head: [...cells.slice(0, k), CONTINUATION_HYPHEN],
        tail: after.mode === 'capitals' ? [...REPEATED_CAPITAL_WORD, ...rest] : rest,
        natural: false,
        size: k + 1,
      });
    }
  }
  // Each split must make progress, or a repeated capital sign could grow the word forever.
  const fitting = candidates.filter((c) => c.size <= room && c.tail.length < cells.length);
  const natural = fitting.filter((c) => c.natural);
  const best = (natural.length > 0 ? natural : fitting).at(-1);
  return best ? { head: best.head, tail: best.tail } : null;
}

export function layout(
  translation: Translation,
  cellsPerRow: number,
  rowsPerPage: number | null = null,
): SlateLayout {
  if (!Number.isInteger(cellsPerRow) || cellsPerRow < MIN_CELLS_PER_ROW) {
    throw new Error(`Cells per row must be a whole number of at least ${MIN_CELLS_PER_ROW}.`);
  }
  if (rowsPerPage !== null && (!Number.isInteger(rowsPerPage) || rowsPerPage < 1)) {
    throw new Error('Rows per page must be a whole number of at least 1.');
  }

  const warnings: string[] = [];
  const rows: Row[] = [];

  for (const paragraph of translation.paragraphs) {
    let line: BrailleCell[] = [];
    const flush = () => {
      rows.push(pad(line, cellsPerRow));
      line = [];
    };

    if (paragraph.length === 0) {
      flush();
      continue;
    }

    for (const word of paragraph) {
      let rest = word.cells;
      let split = false;
      for (;;) {
        const room = line.length === 0 ? cellsPerRow : cellsPerRow - line.length - 1;
        if (rest.length <= room) {
          line = line.length === 0 ? [...rest] : [...line, SPACE, ...rest];
          break;
        }
        // A word that fits on a row of its own is never divided; it moves to the next row.
        if (line.length > 0 && rest.length <= cellsPerRow) {
          flush();
          continue;
        }
        // Too long for any row: divide it, using what's left of the current row if possible.
        const division =
          findSplit(rest, room, true) ??
          (line.length === 0 ? findSplit(rest, room, false) : null) ??
          (line.length === 0 ? { head: rest.slice(0, room), tail: rest.slice(room) } : null);
        if (!division) {
          flush();
          continue;
        }
        line = line.length === 0 ? division.head : [...line, SPACE, ...division.head];
        flush();
        rest = division.tail;
        split = true;
      }
      if (split) warnings.push(`"${word.print}" is longer than a row, so it was divided.`);
    }
    if (line.length > 0) flush();
  }

  const pages: Row[][] = [];
  if (rowsPerPage === null) {
    pages.push(rows);
  } else {
    for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  return { cellsPerRow, rowsPerPage, pages, warnings };
}

export function isSpace(cell: BrailleCell | null): boolean {
  return cell === null || cell === SPACE;
}

/** The row as punched from the back: right-to-left order, each cell mirrored. */
export function toWritingOrder(row: Row): WritingSlot[] {
  return row
    .map((cell, readingIndex) => ({
      cell: cell === SPACE ? null : cell,
      writeDots: cell && cell !== SPACE ? mirror(cell.dots) : 0,
      readingIndex,
    }))
    .reverse();
}

/** Number of slots actually used in a row (ignoring trailing empties). */
export function usedLength(row: Row): number {
  let n = row.length;
  while (n > 0 && isSpace(row[n - 1]!)) n--;
  return n;
}
