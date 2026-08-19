import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { findDatabaseReferences } from '../src/lib/database-references';

describe('findDatabaseReferences', () => {
  it('finds item references in initial state and recursive event commands', () => {
    const game = createEmptyProject('References').game;
    game.items[1] = { name: 'Potion', type: 'consumable', healing: 10 };
    game.initialState.inventory = { 1: 2 };
    game.maps[1].events.push({
      id: 1, name: 'event-1', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
        movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
        options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
        priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
        conditions: [{ kind: 'item', id: 1 }],
        contents: [{ type: 'dialogue', speaker: 'Guide', text: 'Choose', choices: [{ label: 'Take', commands: [{ type: 'giveItem', id: 1 }] }] }],
      }],
    });

    const references = findDatabaseReferences(game, 'item', 1);
    expect(references.map(reference => reference.label)).toContain('Initial inventory');
    expect(references.filter(reference => reference.label.includes('event-1'))).toHaveLength(2);
  });

  it('finds skill references on the player and in nested enemy commands', () => {
    const game = createEmptyProject('References').game;
    game.enemies[1] = {
      name: 'Slime', color: '#00ff00', stats: { maxHp: 10, attack: 1, defense: 0 }, rewards: { xp: 1 }, speed: 1, radius: 1, behavior: 'chase',
      onDefeated: [{ type: 'conditional', condition: { kind: 'switch', id: 1, operand: { kind: 'gameData', data: { kind: 'skillUnlocked', skillId: 1 } } }, thenCommands: [{ type: 'unlockSkill', id: 1 }] }],
    };

    const references = findDatabaseReferences(game, 'skill', 1);
    expect(references.some(reference => reference.path === 'actors.player.primaryAttack')).toBe(true);
    expect(references.filter(reference => reference.label === 'Slime · on defeated')).toHaveLength(2);
  });

  it('returns no usages for an unreferenced entry', () => {
    const game = createEmptyProject('References').game;
    game.items[1] = { name: 'Key', type: 'quest' };
    expect(findDatabaseReferences(game, 'item', 1)).toEqual([]);
  });

  it('finds common event calls and switch triggers', () => {
    const game = createEmptyProject('Common references').game;
    game.initialState.switches[1] = { name: 'Ready', initialValue: false };
    game.events.commonEvents[1] = { name: 'First', trigger: { type: 'autorun', switchId: 1 }, contents: [{ type: 'callCommonEvent', id: 2 }] };
    game.events.commonEvents[2] = { name: 'Second', trigger: { type: 'none' }, contents: [] };
    expect(findDatabaseReferences(game, 'switch', 1)[0].path).toBe('events.commonEvents.1.trigger.switchId');
    expect(findDatabaseReferences(game, 'commonEvent', 2)[0].path).toBe('events.commonEvents.1.contents[0]');
  });

  it('finds equipment type references in items and initial equipment', () => {
    const game = createEmptyProject('Type references').game;
    game.items[1] = { name: 'Sword', type: 'equipment', equipmentTypeId: 1 };
    game.initialState.equipment = { 1: 1 };
    expect(findDatabaseReferences(game, 'equipmentType', 1).map(reference => reference.path)).toEqual([
      'items.1.equipmentTypeId', 'initialState.equipment.1',
    ]);
  });

  it('finds switch and variable references across recursive commands and teleport sources', () => {
    const game = createEmptyProject('System references').game;
    game.initialState.switches[1] = { name: 'Ready', initialValue: false };
    game.initialState.variables[1] = { name: 'Score', initialValue: 0 };
    game.maps[1].events.push({
      id: 1, name: 'system-event', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
        movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
        options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
        priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
        conditions: [{ kind: 'switch', id: 1, operand: { kind: 'switch', switchId: 1 } }],
        contents: [{
          type: 'conditional', condition: { kind: 'variable', id: 1, operator: 'equal', operand: { kind: 'variable', variableId: 1 } },
          thenCommands: [{ type: 'setVariable', id: 1, operation: 'add', operand: { kind: 'variable', variableId: 1 } }],
          elseCommands: [{ type: 'teleport', destination: { map: { kind: 'constant', mapId: 1 }, x: { kind: 'variable', variableId: 1 }, y: { kind: 'constant', value: 1 } }, direction: 'retain', transition: 'instant' }],
        }],
      }],
    });

    expect(findDatabaseReferences(game, 'switch', 1)).toHaveLength(2);
    expect(findDatabaseReferences(game, 'variable', 1)).toHaveLength(5);
  });
});
