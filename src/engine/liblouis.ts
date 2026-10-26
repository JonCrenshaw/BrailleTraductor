// Minimal binding to liblouis compiled to WebAssembly (public/liblouis/, built by
// scripts/build-liblouis.sh). Only lou_translate is used. The engine never loads the module itself;
// the caller (UI or tests) loads it and passes it in, so this file stays free of I/O.

import type { Dots } from './cell';

/** The parts of the Emscripten module this binding needs. */
export interface LiblouisModule {
  _lou_translate(
    tableList: number,
    inbuf: number,
    inlen: number,
    outbuf: number,
    outlen: number,
    typeform: number,
    spacing: number,
    outputPos: number,
    inputPos: number,
    cursorPos: number,
    mode: number,
  ): number;
  _lou_version(): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number): string;
  stringToUTF8(str: string, ptr: number, maxBytes: number): void;
  lengthBytesUTF8(str: string): number;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
}

// Translation mode flags from liblouis.h.
const DOTS_IO = 4;
const UC_BRL = 64;

export interface RawTranslation {
  /** Output cells; 0 is a blank cell (a space). */
  cells: Dots[];
  /** For each output cell, the index (in code points) of the input character it came from. */
  inputPos: number[];
}

export function liblouisVersion(lou: LiblouisModule): string {
  return lou.UTF8ToString(lou._lou_version());
}

export function louTranslate(lou: LiblouisModule, table: string, text: string): RawTranslation {
  const codepoints = [...text].map((c) => c.codePointAt(0)!);
  const inLen = codepoints.length;
  if (inLen === 0) return { cells: [], inputPos: [] };
  const outMax = inLen * 4 + 32;

  const tableBytes = lou.lengthBytesUTF8(table) + 1;
  const tablePtr = lou._malloc(tableBytes);
  const inPtr = lou._malloc(inLen * 4);
  const inLenPtr = lou._malloc(4);
  const outPtr = lou._malloc(outMax * 4);
  const outLenPtr = lou._malloc(4);
  const inputPosPtr = lou._malloc(outMax * 4);

  try {
    lou.stringToUTF8(table, tablePtr, tableBytes);
    // Heap views can be replaced when memory grows, so read them after every allocation.
    lou.HEAPU32.set(codepoints, inPtr >> 2);
    lou.HEAP32[inLenPtr >> 2] = inLen;
    lou.HEAP32[outLenPtr >> 2] = outMax;

    const ok = lou._lou_translate(
      tablePtr,
      inPtr,
      inLenPtr,
      outPtr,
      outLenPtr,
      0,
      0,
      0,
      inputPosPtr,
      0,
      DOTS_IO | UC_BRL,
    );
    if (!ok) throw new Error(`liblouis could not translate with table ${table}.`);

    const outLen = lou.HEAP32[outLenPtr >> 2]!;
    const out = lou.HEAPU32.subarray(outPtr >> 2, (outPtr >> 2) + outLen);
    const pos = lou.HEAP32.subarray(inputPosPtr >> 2, (inputPosPtr >> 2) + outLen);
    const cells: Dots[] = [];
    for (const ch of out) {
      // Unicode braille (U+2800 block) or, for spaces, a plain space character.
      cells.push(ch >= 0x2800 && ch <= 0x28ff ? (ch - 0x2800) & 0x3f : 0);
    }
    return { cells, inputPos: [...pos] };
  } finally {
    for (const p of [tablePtr, inPtr, inLenPtr, outPtr, outLenPtr, inputPosPtr]) lou._free(p);
  }
}
