# Braille Slate Writer

Type English, get the exact braille cells to punch with a **slate and stylus**: mirrored, right to
left, and wrapped to the number of cells on your slate, so the finished page reads left-aligned when
you flip it over.

**Live:** https://joncrenshaw.github.io/BrailleTraductor/

## Features

- Unified English Braille (UEB) **Grade 1**: letters, capitals (including capital-word and
  capital-passage signs), numbers, and punctuation.
- **Writing side** view (mirrored, right to left, with a cell ruler counted from the right edge)
  and **reading side** view (the finished page).
- Word wrapping to your slate's cells per row; optional rows per page.
- Hover over, or tab to, any cell to see what it means and how it looks on both sides.
- Unicode braille text output for braille displays, screen readers, or pasting elsewhere.
- Keyboard and screen reader friendly: one tab stop into the slate, arrow keys to move between
  cells, every cell labelled, and polite announcements when the output changes.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck, lint, format, tests with coverage, build
```

Pushing to `main` runs the same checks in GitHub Actions and deploys to GitHub Pages.
