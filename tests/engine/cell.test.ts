import { describe, expect, it } from 'vitest';
import { describeDots, dotList, dots, dotString, mirror, toUnicode } from '../../src/engine/cell';

describe('cells', () => {
  it('maps dots to the Unicode braille block', () => {
    expect(toUnicode(dots())).toBe('⠀');
    expect(toUnicode(dots(1))).toBe('⠁');
    expect(toUnicode(dotString('125'))).toBe('⠓');
    expect(toUnicode(dotString('123456'))).toBe('⠿');
  });

  it('lists and describes dots', () => {
    expect(dotList(dotString('2456'))).toEqual([2, 4, 5, 6]);
    expect(describeDots(dotString('1'))).toBe('dot 1');
    expect(describeDots(dotString('125'))).toBe('dots 1-2-5');
    expect(describeDots(0)).toBe('blank');
  });

  it('rejects dots outside 1–6', () => {
    expect(() => dots(7)).toThrow();
    expect(() => dots(0)).toThrow();
  });

  it('mirrors left and right columns', () => {
    expect(mirror(dots(1))).toBe(dots(4));
    expect(mirror(dots(3, 6))).toBe(dots(3, 6));
    // "h" (1-2-5) punched from the back looks like "j" (2-4-5).
    expect(mirror(dotString('125'))).toBe(dotString('245'));
    for (let c = 0; c < 64; c++) expect(mirror(mirror(c))).toBe(c);
  });
});
