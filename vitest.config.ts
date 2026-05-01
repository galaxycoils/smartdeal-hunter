import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const thresholds = JSON.parse(
  readFileSync(resolve(__dirname, '.coverage-thresholds.json'), 'utf8'),
) as { lines: number; branches: number; functions: number; statements: number };

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['entrypoints/**', 'lib/**', 'components/**'],
      exclude: ['**/*.d.ts', '**/*.config.{ts,js}', 'tests/**'],
      thresholds: {
        lines: thresholds.lines,
        branches: thresholds.branches,
        functions: thresholds.functions,
        statements: thresholds.statements,
      },
    },
  },
});
