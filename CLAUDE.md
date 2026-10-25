# CLAUDE.md

Notes for Claude Code sessions on this repo. Keep this file short; this is a small project.

## What it is

A static web tool that translates English into braille and lays it out for writing with a slate and
stylus (mirrored, right to left, wrapped to the slate's cells per row). Owner: Jon Crenshaw, who
writes braille by hand for blind recipients. Jon is a novice in web/TypeScript and in braille rules,
so Claude is responsible for getting the braille right and should explain choices as it goes.

## Architecture

- `src/engine/`: pure TypeScript, no DOM (ESLint enforces it). It can be reused in a future app.
  - `cell.ts`: six-dot cells as bitmasks (same bit layout as Unicode U+2800), mirroring.
  - `symbols.ts`: UEB symbol tables.
  - `grade1.ts`: UEB Grade 1 translator (capitals, numbers, punctuation rules).
  - `translate.ts`: the translator registry; `layout.ts`: slate rows, wrapping, writing order.
- `src/ui/`: a thin DOM layer that only draws what the engine returns. No braille rules here.

## Braille correctness

- The standard is **Unified English Braille** (UEB Rulebook 2013; BANA "ABCs of UEB").
- Every rule change needs a test in `tests/engine/` with the expected braille, citing the rule or
  source when it isn't obvious. Engine coverage must stay at or above 90%.
- **Grade 2 (contracted)** is planned as a selectable option. Add it as a new `Translator` in
  `TRANSLATORS` (`translate.ts`); layout and UI don't change. Preferred route: liblouis
  (`en-ueb-g2.ctb`) compiled to WebAssembly, rather than hand-writing about 180 contraction rules.
  The cell `name` field must still explain each cell (for example "contraction: the").

## Row breaks (`layout.ts`)

- Words that fit on a row are never divided. Longer words start in the space left on the current
  row and are divided with a hyphen. If the word already has a hyphen or dash, the break goes after
  it and nothing is added.
- Inside a number, the row ends with the continuation sign (dot 5) and the number sign isn't
  repeated (UEB §6.10). In capital-word mode the capital word sign is repeated on the next row.
- Translators mark cells with `joinNext` (never break after this cell) and `mode` (capitals or
  numeric) so layout can do this without knowing braille rules. Grade 2 must set them too.

## Known simplifications

- Accented letters are written without the accent (with a warning) instead of using UEB accent
  signs.
- Long words are divided wherever they fit best (after an existing hyphen if possible), not at
  syllable boundaries as a professional transcriber would.
- A straight `'` is taken as an opening single quote only at the start of a word.

## Workflow

- `npm run check` must pass before pushing. CI runs the same checks and deploys `main` to Pages.
- For anything beyond a trivial fix, use a branch and a PR, and merge after CI passes.
- `vite.config.ts` sets `base: '/BrailleTraductor/'` for GitHub Pages. Change it to `/` for a
  custom domain.
- Accessibility is a feature: keep labelled controls, the roving tab stop in the slate, the
  `aria-label` on each cell, and the live-region announcements working. Check with NVDA when the
  UI changes noticeably.
