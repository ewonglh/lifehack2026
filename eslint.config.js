import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';

const browserGlobals = {
  FormData: 'readonly',
  console: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  window: 'readonly',
};

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        process: 'readonly',
      },
    },
  },
  prettierConfig,
]);
