// Lays translated braille out on a slate: a fixed number of cells per row and, optionally, rows per
// page. Rows are built in reading order (how the finished page is read, left to right). The writing
// view is derived from that: on the back of the paper each row runs right to left and each cell is
// mirrored, so the reader's left margin is the writer's right edge.

import { mirror, type Dots } from './cell';
import { PUNCTUATION } from './symbols';
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

const HYPHEN = PUNCTUATION['-']!;
const CONTINUATION_HYPHEN: BrailleCell = {
  dots: HYPHEN.dots[0]!,
  kind: 'punctuation',
  print: '-',
  name: 'hyphen: the word continues on the next row',
};

/** Marker for the blank cell between words; rendered as an empty slot. */
const SPACE: BrailleCell = { dots: 0, kind: 'punctuation', print: ' ', name: 'space' };

export const MIN_CELLS_PER_ROW = 4;

function pad(cells: BrailleCell[], width: number): Row {
  return [...cells, ...Array<null>(width - cells.length).fill(null)];
}

/**
 * Split a word that's longer than a whole row into row-sized pieces, each ending in a hyphen.
 * Never break right after an indicator, because it belongs with the cell it modifies.
 */
function splitLongWord(cells: BrailleCell[], width: number): BrailleCell[][] {
  const pieces: BrailleCell[][] = [];
  let rest = cells;
  while (rest.length > width) {
    let cut = width - 1;
    while (cut > 1 && rest[cut - 1]!.kind === 'indicator') cut--;
    pieces.push([...rest.slice(0, cut), CONTINUATION_HYPHEN]);
    rest = rest.slice(cut);
  }
  pieces.push(rest);
  return pieces;
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
      const pieces =
        word.cells.length > cellsPerRow ? splitLongWord(word.cells, cellsPerRow) : [word.cells];
      if (pieces.length > 1)
        warnings.push(`"${word.print}" is longer than a row, so it was split.`);

      for (const piece of pieces) {
        const needed = line.length === 0 ? piece.length : line.length + 1 + piece.length;
        if (needed > cellsPerRow) flush();
        line = line.length === 0 ? [...piece] : [...line, SPACE, ...piece];
        if (piece.at(-1) === CONTINUATION_HYPHEN) flush();
      }
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
