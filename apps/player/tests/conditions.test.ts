import { describe, expect, it } from 'vitest';
import { conditionsMet } from '../src/conditions.js';

const state = {
  switches: { 1: true, 2: true },
  variables: { 1: 10, 2: 8 },
  inventory: { 1: 2 },
  equipment: { 1: 2 },
  unlockedSkills: [1],
  player: { hp: 7, maxHp: 10, level: 3, xp: 42 },
  mapId: 4,
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
    expect(conditionsMet([{ kind: 'variable', id: 1, operator, operand: { kind: 'constant', value } }], state)).toBe(expected);
  });

  it('compares switches with switches and boolean game data', () => {
    expect(conditionsMet([{ kind: 'switch', id: 1, operand: { kind: 'switch', switchId: 2 } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 1, operand: { kind: 'gameData', data: { kind: 'hasItem', itemId: 1 } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 1, operand: { kind: 'gameData', data: { kind: 'itemEquipped', itemId: 2 } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'switch', id: 1, operand: { kind: 'gameData', data: { kind: 'skillUnlocked', skillId: 1 } } }], state)).toBe(true);
  });

  it('compares variables with variables and numeric game data', () => {
    expect(conditionsMet([{ kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'variable', variableId: 2 } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'itemAmount', itemId: 1 } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'playerStat', stat: 'hp' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'mapId' } } }], state)).toBe(true);
    expect(conditionsMet([{ kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'player' }, axis: 'x' } } }], state)).toBe(true);
  });

  it('requires every condition to match', () => {
    expect(conditionsMet([
      { kind: 'switch', id: 1, operand: { kind: 'constant', value: true } },
      { kind: 'item', id: 1, amount: 2 },
      { kind: 'variable', id: 1, operator: 'greaterThanOrEqual', operand: { kind: 'constant', value: 10 } },
    ], state)).toBe(true);
    expect(conditionsMet([
      { kind: 'switch', id: 1, operand: { kind: 'constant', value: true } },
      { kind: 'variable', id: 1, operator: 'greaterThan', operand: { kind: 'constant', value: 10 } },
    ], state)).toBe(false);
  });
});
