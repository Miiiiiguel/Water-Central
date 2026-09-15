import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the pure logic (the ROI financial model above all).
// Browser-level checks live in scripts/perf-check.mjs instead.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'client', 'src') },
  },
  test: {
    environment: 'node',
    include: ['client/src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
