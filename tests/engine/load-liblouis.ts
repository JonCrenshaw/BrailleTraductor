// Loads the committed liblouis WebAssembly build in Node for tests.
import { fileURLToPath } from 'node:url';
import createLiblouis from '../../public/liblouis/liblouis.mjs';
import type { LiblouisModule } from '../../src/engine/liblouis';

const dir = fileURLToPath(new URL('../../public/liblouis/', import.meta.url));

let loaded: Promise<LiblouisModule> | undefined;

export function loadLiblouis(): Promise<LiblouisModule> {
  loaded ??= createLiblouis({
    locateFile: (file: string) => dir + file,
  }) as Promise<LiblouisModule>;
  return loaded;
}
