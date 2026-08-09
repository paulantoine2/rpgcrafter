import { describe, expect, it } from 'vitest';
import { conditionalCommands } from '../src/conditional.js';

const state = {
  switches: { ready: true },
  variables: { score: 10 },
  inventory: { potion: 2 },
  equipment: {},
  unlockedSkills: [],
  player: { hp: 10, maxHp: 10, level: 1, xp: 0 },
  mapNumericId: 1,
  tileSize: 48,
  characterPosition: () => ({ x: 0, y: 0, planeId: 'main' }),
};

describe('conditionalCommands', () => {
  it('selects the matching then branch', () => {
    const commands = conditionalCommands({
      type: 'conditional',
      condition: { kind: 'switch', id: 'ready', operand: { kind: 'constant', value: true } },
      thenCommands: [{ type: 'toast', text: 'Then' }],
      elseCommands: [{ type: 'toast', text: 'Else' }],
    }, state);

    expect(commands).toEqual([{ type: 'toast', text: 'Then' }]);
  });

  it('selects else or no commands when the condition fails', () => {
    const command = {
      type: 'conditional' as const,
      condition: { kind: 'variable' as const, id: 'score', operator: 'greaterThan' as const, operand: { kind: 'constant' as const, value: 10 } },
      thenCommands: [{ type: 'toast' as const, text: 'Then' }],
      elseCommands: [{ type: 'toast' as const, text: 'Else' }],
    };

    expect(conditionalCommands(command, state)).toEqual([{ type: 'toast', text: 'Else' }]);
    expect(conditionalCommands({ ...command, elseCommands: undefined }, state)).toEqual([]);
  });

  it('returns nested branches for the command process to execute in order', () => {
    const nested = { type: 'conditional' as const, condition: { kind: 'item' as const, id: 'potion', amount: 2 }, thenCommands: [{ type: 'save' as const }] };
    const selected = conditionalCommands({ type: 'conditional', condition: { kind: 'switch', id: 'ready', operand: { kind: 'constant', value: true } }, thenCommands: [{ type: 'toast', text: 'First' }, nested] }, state);

    expect(selected).toEqual([{ type: 'toast', text: 'First' }, nested]);
    expect(conditionalCommands(nested, state)).toEqual([{ type: 'save' }]);
  });
});
