import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'public/liblouis'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  { languageOptions: { globals: { ...globals.browser } } },
  {
    // noUncheckedIndexedAccess types every array/record lookup as possibly undefined; after a
    // bounds check or a lookup in a fixed table, `!` is the honest way to say "this exists".
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // The engine is pure: no DOM, no UI imports, so it can be reused in an app later.
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/ui/**'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
    },
  },
  prettier,
);
