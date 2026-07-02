import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    globals: true,
    // Nested git worktrees live under .worktrees and duplicate the test suite.
    exclude: [...configDefaults.exclude, '.worktrees/**']
  }
});
