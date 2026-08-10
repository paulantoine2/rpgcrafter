import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { findDatabaseReferences } from '../src/lib/database-references';

describe('findDatabaseReferences', () => {
  it('finds item references in initial state and recursive event commands', () => {
    const game = createEmptyProject('References').game;
    game.items.potion = { name: 'Potion', type: 'consumable', healing: 10 };
    game.initialState.inventory = { potion: 2 };
    game.maps['map-1'].events.push({
      id: 'event-1', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
        movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
        options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
        priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
        conditions: [{ kind: 'item', id: 'potion' }],
        contents: [{ type: 'dialogue', speaker: 'Guide', text: 'Choose', choices: [{ label: 'Take', commands: [{ type: 'giveItem', id: 'potion' }] }] }],
      }],
    });

    const references = findDatabaseReferences(game, 'item', 'potion');
    expect(references.map(reference => reference.label)).toContain('Initial inventory');
    expect(references.filter(reference => reference.label.includes('event-1'))).toHaveLength(2);
  });

  it('finds skill references on the player and in nested enemy commands', () => {
    const game = createEmptyProject('References').game;
    game.enemies.slime = {
      name: 'Slime', color: '#00ff00', hp: 10, speed: 1, damage: 1, radius: 1, xp: 1, behavior: 'chase',
      onDefeated: [{ type: 'conditional', condition: { kind: 'switch', id: 'ready', operand: { kind: 'gameData', data: { kind: 'skillUnlocked', skillId: 'basic-attack' } } }, thenCommands: [{ type: 'unlockSkill', id: 'basic-attack' }] }],
    };

    const references = findDatabaseReferences(game, 'skill', 'basic-attack');
    expect(references.some(reference => reference.path === 'actors.player.primaryAttack')).toBe(true);
    expect(references.filter(reference => reference.label === 'Slime · on defeated')).toHaveLength(2);
  });

  it('returns no usages for an unreferenced entry', () => {
    const game = createEmptyProject('References').game;
    game.items.key = { name: 'Key', type: 'quest' };
    expect(findDatabaseReferences(game, 'item', 'key')).toEqual([]);
  });

  it('finds common event calls and switch triggers', () => {
    const game = createEmptyProject('Common references').game;
    game.initialState.switches.ready = { name: 'Ready', initialValue: false };
    game.events.commonEvents.first = { name: 'First', trigger: { type: 'autorun', switchId: 'ready' }, contents: [{ type: 'callCommonEvent', id: 'second' }] };
    game.events.commonEvents.second = { name: 'Second', trigger: { type: 'none' }, contents: [] };
    expect(findDatabaseReferences(game, 'switch', 'ready')[0].path).toBe('events.commonEvents.first.trigger.switchId');
    expect(findDatabaseReferences(game, 'commonEvent', 'second')[0].path).toBe('events.commonEvents.first.contents[0]');
  });

  it('finds equipment type references in items and initial equipment', () => {
    const game = createEmptyProject('Type references').game;
    game.items.sword = { name: 'Sword', type: 'equipment', equipmentTypeId: 1 };
    game.initialState.equipment = { '1': 'sword' };
    expect(findDatabaseReferences(game, 'equipmentType', '1').map(reference => reference.path)).toEqual([
      'items.sword.equipmentTypeId', 'initialState.equipment.1',
    ]);
  });

  it('finds switch and variable references across recursive commands and teleport sources', () => {
    const game = createEmptyProject('System references').game;
    game.initialState.switches.ready = { name: 'Ready', initialValue: false };
    game.initialState.variables.score = { name: 'Score', initialValue: 0 };
    game.maps['map-1'].events.push({
      id: 'system-event', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
        movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
        options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
        priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
        conditions: [{ kind: 'switch', id: 'ready', operand: { kind: 'switch', switchId: 'ready' } }],
        contents: [{
          type: 'conditional', condition: { kind: 'variable', id: 'score', operator: 'equal', operand: { kind: 'variable', variableId: 'score' } },
          thenCommands: [{ type: 'setVariable', id: 'score', operation: 'add', operand: { kind: 'variable', variableId: 'score' } }],
          elseCommands: [{ type: 'teleport', destination: { map: { kind: 'constant', mapId: 'map-1' }, x: { kind: 'variable', variableId: 'score' }, y: { kind: 'constant', value: 1 } }, direction: 'retain', transition: 'instant' }],
        }],
      }],
    });

    expect(findDatabaseReferences(game, 'switch', 'ready')).toHaveLength(2);
    expect(findDatabaseReferences(game, 'variable', 'score')).toHaveLength(5);
  });
});
