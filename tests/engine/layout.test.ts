import { describe, expect, it } from 'vitest';
import { mirror, toUnicode } from '../../src/engine/cell';
import { layout, toWritingOrder, usedLength, type Row } from '../../src/engine/layout';
import { translate } from '../../src/engine/translate';

/** Reading-order row as Unicode, empty slots as '·'. */
function show(row: Row): string {
  return row.map((c) => (c === null || c.print === ' ' ? '·' : toUnicode(c.dots))).join('');
}

function rows(text: string, width: number, perPage: number | null = null): string[][] {
  return layout(translate(text), width, perPage).pages.map((p) => p.map(show));
}

describe('layout', () => {
  it('pads each row to the slate width, left aligned for the reader', () => {
    expect(rows('gorgeous', 10)).toEqual([['⠛⠕⠗⠛⠑⠕⠥⠎··']]);
  });

  it('wraps at word boundaries', () => {
    expect(rows('aa bb cc', 5)).toEqual([['⠁⠁·⠃⠃', '⠉⠉···']]);
  });

  it('starts each input line on a new row and keeps blank lines', () => {
    expect(rows('a\n\nb', 4)).toEqual([['⠁···', '····', '⠃···']]);
  });

  it('splits words longer than a row with a hyphen', () => {
    const result = layout(translate('abcdefghij'), 4);
    expect(result.pages[0]!.map(show)).toEqual(['⠁⠃⠉⠤', '⠙⠑⠋⠤', '⠛⠓⠊⠚']);
    expect(result.warnings).toEqual(['"abcdefghij" is longer than a row, so it was split.']);
  });

  it('continues after a split word on the same row', () => {
    expect(rows('abcdef hi', 4)).toEqual([['⠁⠃⠉⠤', '⠙⠑⠋·', '⠓⠊··']]);
    expect(rows('abcde f', 4)).toEqual([['⠁⠃⠉⠤', '⠙⠑·⠋']]);
  });

  it('never splits a word right after an indicator', () => {
    // "x⠠⠠ABCDEFG": a plain cut at 3 cells would end the first row on the second ⠠.
    const result = layout(translate('xABCDEFG'), 4);
    for (const row of result.pages[0]!) {
      const used = row.slice(0, usedLength(row));
      expect(used.at(-1)?.kind).not.toBe('indicator');
    }
  });

  it('splits rows into pages', () => {
    expect(rows('aaa bbb ccc', 4, 2)).toEqual([['⠁⠁⠁·', '⠃⠃⠃·'], ['⠉⠉⠉·']]);
  });

  it('returns one empty page for empty input', () => {
    expect(layout(translate(''), 10).pages).toEqual([[]]);
  });

  it('rejects bad dimensions', () => {
    expect(() => layout(translate('a'), 3)).toThrow();
    expect(() => layout(translate('a'), 10.5)).toThrow();
    expect(() => layout(translate('a'), 10, 0)).toThrow();
  });
});

describe('writing order', () => {
  it('reverses the row and mirrors every cell', () => {
    const row = layout(translate('gorgeous'), 10).pages[0]![0]!;
    const slots = toWritingOrder(row);
    // Writer sees two empty cells on the left, then "suoegrog" mirrored, starting at the right.
    expect(slots.map((s) => (s.cell ? s.cell.print : '·')).join('')).toBe('··suoegrog');
    expect(slots.map((s) => s.readingIndex)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    const last = slots.at(-1)!;
    expect(last.writeDots).toBe(mirror(last.cell!.dots));
  });

  it('treats word spaces as empty slots', () => {
    const slots = toWritingOrder(layout(translate('a b'), 4).pages[0]![0]!);
    expect(slots.map((s) => s.cell?.print ?? '·').join('')).toBe('·b·a');
    expect(slots.every((s) => s.cell !== null || s.writeDots === 0)).toBe(true);
  });

  it('counts used length ignoring trailing blanks', () => {
    const row = layout(translate('ab c'), 8).pages[0]![0]!;
    expect(usedLength(row)).toBe(4);
  });
});
