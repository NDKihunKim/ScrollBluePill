import eslintPluginAstro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // ── Global ignores ──────────────────────────────────────────
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.astro/',
      'outputs/',
      'test-results/',
      'supabase/',
      'scripts/',
      '**/*.json',
      '**/*.seed.*',
    ],
  },

  // ── Astro files ─────────────────────────────────────────────
  ...eslintPluginAstro.configs['flat/recommended'],

  // ── JS / MJS / TS files ─────────────────────────────────────
  {
    files: ['**/*.js', '**/*.mjs', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLSelectElement: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        crypto: 'readonly',
        structuredClone: 'readonly',
        CustomEvent: 'readonly',
        globalThis: 'readonly',
        JSON: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        parseInt: 'readonly',
        Error: 'readonly',
        TypeError: 'readonly',
        Event: 'readonly',
        NodeList: 'readonly',
        history: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'error',
      'no-extra-semi': 'warn',
      'no-duplicate-imports': 'warn',
    },
  },

  // ── TypeScript files ────────────────────────────────────────
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'off', // defer to base no-unused-vars (warn)
    },
  },

  // ── Debug module: allow console.log ──────────────────────────
  {
    files: ['src/lib/debug.mjs'],
    rules: { 'no-console': 'off' },
  },

  // ── Disable Prettier-conflicting rules ──────────────────────
  eslintConfigPrettier,
];
