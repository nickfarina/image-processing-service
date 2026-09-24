import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: {
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        AbortSignal: 'readonly',
        DOMException: 'readonly',
        Response: 'readonly',
        ReadableStreamDefaultReader: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: tseslint.configs.recommended.rules,
  },
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
];
