// A braille cell is six dots in two columns:
//
//   1 • • 4
//   2 • • 5
//   3 • • 6
//
// We store a cell as a 6-bit mask (bit 0 = dot 1 … bit 5 = dot 6). That is exactly the layout
// Unicode uses for its braille block, so the Unicode character is simply U+2800 + mask.

export type Dots = number;

export const BLANK: Dots = 0;

/** Build a cell from dot numbers, e.g. dots(1, 2, 5) for "h". */
export function dots(...nums: number[]): Dots {
  let mask = 0;
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`Invalid braille dot: ${n}`);
    mask |= 1 << (n - 1);
  }
  return mask;
}

/** Build a cell from a dot string, e.g. dotString('125') for "h". */
export function dotString(s: string): Dots {
  return dots(...[...s].map(Number));
}

/** The dot numbers raised in a cell, ascending. */
export function dotList(cell: Dots): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) if (cell & (1 << i)) out.push(i + 1);
  return out;
}

/** Human-readable dot description, e.g. "dots 1-2-5", or "blank". */
export function describeDots(cell: Dots): string {
  const list = dotList(cell);
  if (list.length === 0) return 'blank';
  return `${list.length === 1 ? 'dot' : 'dots'} ${list.join('-')}`;
}

export function toUnicode(cell: Dots): string {
  return String.fromCodePoint(0x2800 + cell);
}

/**
 * The cell as seen from the back of the paper, which is how you punch it with a slate and stylus:
 * the left and right columns swap (1↔4, 2↔5, 3↔6).
 */
export function mirror(cell: Dots): Dots {
  const left = cell & 0b000111;
  const right = (cell & 0b111000) >> 3;
  return (left << 3) | right;
}
