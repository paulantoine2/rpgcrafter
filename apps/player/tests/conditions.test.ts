import { describe, expect, it } from 'vitest';
import { conditionsMet } from '../src/conditions.js';

const state = {
  switches: { ready: true, other: true },
  variables: { score: 10, target: 8 },
  inventory: { potion: 2 },
  equipment: { weapon: 'sword' },
  unlockedSkills: ['dash'],
  player: { hp: 7, maxHp: 10, level: 3, xp: 42 },
  mapNumericId: 4,
  tileSize: 48,
  characterPosition: () => ({ x: 120, y: 96, planeId: 'main' }),
  random: () => 0.5,
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
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator, operand: { kind: 'constant', value } }], state)).toBe(expected);
  });

  it('compares switches with switches and boolean game data', () => {
    expect(conditionsMet([{ kind: 'switch', id: 'ready', operand: { kind: 'switch', switchId: 'other' } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 'ready', operand: { kind: 'gameData', data: { kind: 'hasItem', itemId: 'potion' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 'ready', operand: { kind: 'gameData', data: { kind: 'itemEquipped', itemId: 'sword' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 'ready', operand: { kind: 'gameData', data: { kind: 'skillUnlocked', skillId: 'dash' } } }], state)).toBe(true);
  });

  it('compares variables with variables and numeric game data', () => {
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'variable', variableId: 'target' } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'itemAmount', itemId: 'potion' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'playerStat', stat: 'hp' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'mapId' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'player' }, axis: 'x' } } }], state)).toBe(true);
  });

  it('requires every condition to match', () => {
    expect(conditionsMet([
      { kind: 'switch', id: 'ready', operand: { kind: 'constant', value: true } },
      { kind: 'item', id: 'potion', amount: 2 },
      { kind: 'variable', id: 'score', operator: 'greaterThanOrEqual', operand: { kind: 'constant', value: 10 } },
    ], state)).toBe(true);
    expect(conditionsMet([
      { kind: 'switch', id: 'ready', operand: { kind: 'constant', value: true } },
      { kind: 'variable', id: 'score', operator: 'greaterThan', operand: { kind: 'constant', value: 10 } },
    ], state)).toBe(false);
  });
});
