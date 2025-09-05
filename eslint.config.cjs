// ESLint v9 flat config
// Minimal TypeScript setup; can be extended later with prettier or stricter rules
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  { ignores: ['dist/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: ['./tsconfig.json'], sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
