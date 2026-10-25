import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site at https://joncrenshaw.github.io/BrailleTraductor/, so production
  // asset URLs need that prefix. Change this to '/' when moving to a custom domain.
  base: command === 'build' ? '/BrailleTraductor/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      // The engine is the part nobody can eyeball: a wrong dot is a wrong letter on paper.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
}));
