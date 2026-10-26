// Loads liblouis (public/liblouis/, about 0.5 MB) and registers the Grade 2 translator. Imported
// lazily, so people who only use Grade 1 never download any of it.

import { createGrade2 } from '../engine/grade2';
import type { LiblouisModule } from '../engine/liblouis';
import { registerTranslator } from '../engine/translate';

let loading: Promise<void> | undefined;

export function loadGrade2(): Promise<void> {
  loading ??= (async () => {
    // Served as a static file rather than bundled, so the URL is built at runtime.
    const url = new URL(`${import.meta.env.BASE_URL}liblouis/liblouis.mjs`, window.location.href);
    const mod = (await import(/* @vite-ignore */ url.href)) as {
      default: (options: { locateFile: (file: string) => string }) => Promise<LiblouisModule>;
    };
    // Point the .wasm and .data files at the module's own folder; Emscripten would otherwise look
    // for the table data next to the page.
    const lou = await mod.default({ locateFile: (file) => new URL(file, url).href });
    registerTranslator(createGrade2(lou));
  })().catch((err: unknown) => {
    loading = undefined; // allow a retry
    throw err;
  });
  return loading;
}
