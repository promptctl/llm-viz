import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests sit beside the module they exercise; tests/ is Playwright's and its
    // specs cannot run under vitest.
    include: ['src/**/*.test.ts'],
  },
});
