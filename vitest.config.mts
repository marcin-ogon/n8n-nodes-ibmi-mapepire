import { defineConfig } from 'vitest/config';

// ESM config (.mts) so Vitest/Vite use the ESM Node API (avoids deprecated CJS warning)
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { enabled: false },
  },
});
