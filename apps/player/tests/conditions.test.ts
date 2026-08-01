import { describe, expect, it } from 'vitest';
import { conditionsMet } from '../src/conditions.js';

const state = {
  switches: { ready: true },
  variables: { score: 10 },
  inventory: { potion: 2 },
};

describe('conditionsMet', () => {
  it.each([
    ['equal', 10, true],
    ['equal', 9, false],
    ['notEqual', 9, true],
    ['notEqual', 10, false],
    ['greaterThan', 9, true],
    ['greaterThan', 10, false],
    ['greaterThanOrEqual', 10, true],
    ['greaterThanOrEqual', 11, false],
    ['lessThan', 11, true],
    ['lessThan', 10, false],
    ['lessThanOrEqual', 10, true],
    ['lessThanOrEqual', 9, false],
  ] as const)('evaluates %s comparisons', (operator, value, expected) => {
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator, value }], state)).toBe(expected);
  });

  it('requires every condition to match', () => {
    expect(conditionsMet([
      { kind: 'switch', id: 'ready' },
      { kind: 'item', id: 'potion', amount: 2 },
      { kind: 'variable', id: 'score', operator: 'greaterThanOrEqual', value: 10 },
    ], state)).toBe(true);
    expect(conditionsMet([
      { kind: 'switch', id: 'ready' },
      { kind: 'variable', id: 'score', operator: 'greaterThan', value: 10 },
    ], state)).toBe(false);
  });
});
