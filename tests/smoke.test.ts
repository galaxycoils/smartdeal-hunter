import { describe, expect, it } from 'vitest';

describe('bootstrap smoke', () => {
  it('runs vitest under happy-dom', () => {
    expect(typeof window).toBe('object');
    expect(1 + 1).toBe(2);
  });
});
