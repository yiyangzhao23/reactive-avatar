import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/js/**/*.test.js'],
    exclude: ['node_modules/**', 'avatar-live/**', '.venv/**', 'dist/**'],
  },
});
