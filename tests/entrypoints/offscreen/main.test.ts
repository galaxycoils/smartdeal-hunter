import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Offscreen genome sync exclusion', () => {
  it('does not subscribe to genome revision changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'entrypoints/offscreen/main.ts'), 'utf8');
    expect(source).not.toContain('onGenomeChange');
  });
});
