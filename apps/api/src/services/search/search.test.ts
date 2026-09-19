import { describe, expect, it } from 'vitest';
import { closestCorrection, conversationIdFilter, levenshtein } from './index';

describe('chat search helpers', () => {
  it('builds a Meilisearch membership filter', () => {
    expect(conversationIdFilter([])).toBeNull();
    expect(conversationIdFilter(['a', 'b'])).toBe('conversationId IN ["a", "b"]');
  });

  it('corrects nearby typos without rewriting exact matches', () => {
    expect(levenshtein('Yaadro', 'Yaadro')).toBe(0);
    expect(closestCorrection('Yaadro', ['Yaadro API is ready.'])).toBeNull();
    expect(closestCorrection('Yaadru', ['Yaadro API is ready.'])).toBe('Yaadro');
  });
});
