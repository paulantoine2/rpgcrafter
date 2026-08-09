import { describe, expect, it } from 'vitest';
import { applyVariableOperation, resolveSetSwitch, resolveSetVariable, resolveSwitchOperand, resolveVariableOperand, type StateOperandContext } from '../src/state-commands.js';

function context(overrides: Partial<StateOperandContext> = {}): StateOperandContext {
  return {
    switches: { enabled: true, disabled: false },
    variables: { score: 12, factor: 3 },
    inventory: { potion: 2 },
    equipment: { weapon: 'sword', armor: null },
    unlockedSkills: ['dash'],
    player: { hp: 7, maxHp: 10, level: 4, xp: 90 },
    mapNumericId: 6,
    tileSize: 48,
    characterPosition: target => target.kind === 'event' && target.eventId === 'missing' ? undefined : { x: 143, y: 97, planeId: 'main' },
    random: () => 0.25,
    ...overrides,
  };
}

describe('state command operands', () => {
  it('resolves strict boolean sources and switch operations', () => {
    const state = context();
    expect(resolveSwitchOperand({ kind: 'constant', value: false }, state)).toBe(false);
    expect(resolveSwitchOperand({ kind: 'switch', switchId: 'enabled' }, state)).toBe(true);
    expect(resolveSwitchOperand({ kind: 'gameData', data: { kind: 'hasItem', itemId: 'potion' } }, state)).toBe(true);
    expect(resolveSwitchOperand({ kind: 'gameData', data: { kind: 'itemEquipped', itemId: 'sword' } }, state)).toBe(true);
    expect(resolveSwitchOperand({ kind: 'gameData', data: { kind: 'skillUnlocked', skillId: 'dash' } }, state)).toBe(true);
    expect(resolveSetSwitch({ type: 'setSwitch', id: 'enabled', operation: 'toggle' }, true, state)).toBe(false);
    expect(resolveSetSwitch({ type: 'setSwitch', id: 'enabled', operation: 'set', operand: { kind: 'switch', switchId: 'disabled' } }, true, state)).toBe(false);
  });

  it('resolves every numeric source, continuous randomness, and tile coordinates', () => {
    const state = context();
    expect(resolveVariableOperand({ kind: 'constant', value: 2.5 }, state)).toBe(2.5);
    expect(resolveVariableOperand({ kind: 'variable', variableId: 'score' }, state)).toBe(12);
    expect(resolveVariableOperand({ kind: 'random', min: 10, max: 14 }, state)).toBe(11);
    expect(resolveVariableOperand({ kind: 'random', min: 5, max: 5 }, state)).toBe(5);
    expect(resolveVariableOperand({ kind: 'gameData', data: { kind: 'itemAmount', itemId: 'potion' } }, state)).toBe(2);
    expect(resolveVariableOperand({ kind: 'gameData', data: { kind: 'playerStat', stat: 'xp' } }, state)).toBe(90);
    expect(resolveVariableOperand({ kind: 'gameData', data: { kind: 'mapId' } }, state)).toBe(6);
    expect(resolveVariableOperand({ kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'player' }, axis: 'x' } }, state)).toBe(2);
    expect(resolveVariableOperand({ kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'thisEvent' }, axis: 'y' } }, state)).toBe(2);
  });

  it('applies all numeric operations and rejects unsafe results', () => {
    expect(applyVariableOperation(10, 'set', 4)).toBe(4);
    expect(applyVariableOperation(10, 'add', 4)).toBe(14);
    expect(applyVariableOperation(10, 'subtract', 4)).toBe(6);
    expect(applyVariableOperation(10, 'multiply', 4)).toBe(40);
    expect(applyVariableOperation(10, 'divide', 4)).toBe(2.5);
    expect(applyVariableOperation(10, 'modulo', 4)).toBe(2);
    expect(applyVariableOperation(10, 'divide', 0)).toBeUndefined();
    expect(applyVariableOperation(10, 'modulo', 0)).toBeUndefined();
    expect(applyVariableOperation(Number.MAX_VALUE, 'multiply', 2)).toBeUndefined();
    expect(resolveSetVariable({ type: 'setVariable', id: 'score', operation: 'add', operand: { kind: 'variable', variableId: 'factor' } }, 10, context())).toBe(13);
    expect(resolveSetVariable({ type: 'setVariable', id: 'score', operation: 'set', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'event', eventId: 'missing' }, axis: 'x' } } }, 10, context())).toBeUndefined();
  });
});
