import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSourceGame, type SourceGameFiles } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

function toV06(files: SourceGameFiles) {
  const legacy = structuredClone(files) as any;
  legacy.manifest.schemaVersion = '0.6';
  legacy.manifest.engineRange = '>=0.6 <0.7';
  legacy.events.events = {};
  legacy.initialState.flags = Object.fromEntries(Object.entries(legacy.initialState.switches as Record<string, any>).map(([id, definition]) => [id, definition.initialValue]));
  delete legacy.initialState.switches;
  const legacyConditions = (conditions: any[] | undefined) => conditions?.map(condition => condition.kind === 'switch' ? { ...condition, kind: 'flag' } : condition);
  const legacyCommands = (commands: any[]): any[] => commands.map(command => {
    if (command.type === 'dialogue' && command.choices) return { ...command, choices: command.choices.map((choice: any) => ({ label: choice.label, actions: legacyCommands(choice.commands) })) };
    if (command.type === 'teleport') return {
      type: 'teleport',
      mapId: command.destination.map.mapId,
      position: { x: command.destination.x.value, y: command.destination.y.value, planeId: 'plane-1' },
      resetMap: true,
    };
    return command.type === 'setSwitch' ? { ...command, type: 'setFlag' } : command;
  });
  for (const [mapId, map] of Object.entries(legacy.maps) as Array<[string, any]>) {
    for (const event of map.events) {
      const page = event.pages[0];
      const scriptId = `event.${mapId}.${event.id}`;
      legacy.events.events[scriptId] = {
        id: scriptId,
        pages: event.pages.map((item: any) => ({
          ...(item.conditions ? { conditions: legacyConditions(item.conditions) } : {}),
          actions: legacyCommands(item.contents),
        })),
      };
      event.scriptId = scriptId;
      event.trigger = page.trigger.type === 'actionButton'
        ? { type: 'interact', radius: page.trigger.radius }
        : { type: 'playerEnter', size: page.trigger.size };
      event.execution = { mode: 'repeat' };
      if (page.sprite) event.sprite = page.sprite;
      event.movement = { ...page.movement, ...page.options };
      delete event.pages;
    }
  }
  for (const enemy of Object.values(legacy.enemies) as any[]) if (enemy.onDefeated) enemy.onDefeated = legacyCommands(enemy.onDefeated);
  legacy.events.objectives = legacy.events.objectives.map((objective: any) => ({ ...objective, conditions: legacyConditions(objective.conditions) }));
  return legacy;
}

describe('V0.4 migration', () => {
  it('creates one bounds plane and preserves legacy map behavior', () => {
    const files: SourceGameFiles = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    };
    const legacy = toV06(files);
    legacy.manifest.schemaVersion = '0.4'; legacy.manifest.engineRange = '>=0.4 <0.5';
    legacy.tilesets = { 'outside-a2': { ...legacy.tilesets['rpg-maker-mz-outside-a2'], id: 'outside-a2' } };
    for (const map of Object.values(legacy.maps) as any[]) {
      map.obstacles = map.blockedRegions.map(({ planeId: _planeId, ...region }: any) => region);
      delete map.planes; delete map.planeConnections; delete map.navigationOverrides; delete map.blockedRegions;
      map.tileLayers.forEach((layer: any) => {
        layer.tileset = 'outside-a2';
        layer.tiles.forEach((tile: any) => { tile.terrainId = 'meadow'; delete tile.tilesetId; });
        delete layer.planeId;
        delete layer.renderPhase;
      });
      map.events.forEach((event: any) => { delete event.position.planeId; });
      map.enemySpawns.forEach((spawn: any) => { delete spawn.planeId; });
      if (map.deathDestination) delete map.deathDestination.spawn.planeId;
    }
    delete legacy.actors.player.start.planeId;
    const stripActions = (actions: any[]) => actions.forEach(action => { if (action.type === 'teleport') delete action.position.planeId; action.choices?.forEach((choice: any) => stripActions(choice.actions)); });
    Object.values(legacy.events.events).forEach((event: any) => event.pages.forEach((page: any) => stripActions(page.actions)));
    Object.values(legacy.enemies).forEach((enemy: any) => stripActions(enemy.onDefeated || []));

    const result = parseSourceGame(legacy);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest.schemaVersion).toBe('0.16');
    expect(result.data.maps[1].planes).toEqual([{ id: 'plane-1', name: 'Plan 1', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }]);
    expect(result.data.maps[1].blockedRegions[0].planeId).toBe('plane-1');
    expect(result.data.actors.player.start.planeId).toBe('plane-1');
  });
});

describe('legacy event visual migration', () => {
  it('replaces visual metadata with a sprite reference', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    const legacy = toV06(files);
    const event = legacy.maps.village.events.find((item: any) => item.id === 'mayor');
    delete event.sprite;
    event.visual = { type: 'npc', name: 'Mayor', color: '#fff', radius: 18 };

    const result = parseSourceGame(legacy);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.maps[1].events.find(item => item.name === 'mayor')?.pages[0].sprite).toMatchObject({
      image: 'sprites/rpg-maker-mz/Actor1.png',
      characterIndex: 0,
    });
  });
});

describe('V0.6 event-page migration', () => {
  it('inlines scripts without reversing page priority', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    const legacy = toV06(files);
    const result = parseSourceGame(legacy);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const mayor = result.data.maps[1].events.find(event => event.name === 'mayor')!;
    expect(mayor.pages).toHaveLength(4);
    expect(mayor.pages[0].conditions).toEqual([{ kind: 'switch', id: 1, operand: { kind: 'constant', value: false } }]);
    expect(mayor.pages[0].contents[0].type).toBe('dialogue');
    expect(result.data.events).toEqual({ objectives: expect.any(Array), commonEvents: {} });
    expect(result.data.initialState.switches[2]).toEqual({ name: 'Key Chest Opened', initialValue: false });
    expect(Object.values(result.data.maps).flatMap(map => map.events).flatMap(event => event.pages).flatMap(page => page.conditions || []).some(condition => condition.kind === 'switch')).toBe(true);
  });
});

describe('V0.7 draft migration', () => {
  it('preserves switches already saved in the V0.8 initial-state format', () => {
    const mixedDraft = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    (mixedDraft.manifest as any).schemaVersion = '0.7';
    (mixedDraft.manifest as any).engineRange = '>=0.7 <0.8';
    (mixedDraft.initialState as any).switches.unsavedDraftSwitch = { name: 'Unsaved draft switch', initialValue: true };

    const result = parseSourceGame(mixedDraft);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.initialState.switches[6]).toEqual({
      name: 'Unsaved draft switch',
      initialValue: true,
    });
  });

  it('adds an empty variable collection to projects that predate numeric variables', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    delete (files.initialState as any).variables;

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initialState.variables).toEqual({});
  });

  it('removes obsolete quest-state commands from events, choices, and enemies', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    const obsolete = { type: 'setQuestState', id: 'quest.bell-of-mist', state: 'completed' };
    (files.maps as any).village.events[0].pages[0].contents.push(obsolete, {
      type: 'dialogue', speaker: 'Mayor', text: 'Done', choices: [{ label: 'Continue', commands: [obsolete] }],
    });
    (files.enemies as any).slime.onDefeated = [obsolete];

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const contents = result.data.maps[1].events[0].pages[0].contents;
    expect(contents).not.toContainEqual(expect.objectContaining({ type: 'setQuestState' }));
    const dialogue = contents.at(-1);
    expect(dialogue?.type).toBe('dialogue');
    if (dialogue?.type === 'dialogue') expect(dialogue.choices?.[0].commands).toEqual([]);
    expect(result.data.enemies[1].onDefeated).toEqual([]);
  });
});

describe('V0.8 migration', () => {
  it('assigns stable numeric map ids and migrates nested teleports', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    (files.manifest as any).schemaVersion = '0.8';
    (files.manifest as any).engineRange = '>=0.8 <0.9';
    delete (files.manifest as any).nextMapNumericId;
    for (const map of Object.values(files.maps as Record<string, any>)) delete map.numericId;
    const oldTeleport = { type: 'teleport', mapId: 'path', position: { x: 2, y: 3, planeId: 'lower-trail' }, resetMap: true };
    (files.maps as any).village.events[0].pages[0].contents = [{
      type: 'dialogue', speaker: 'Guide', text: 'Go', choices: [{ label: 'Yes', commands: [{
        type: 'conditional', condition: { kind: 'switch', id: 'questAccepted', equals: true }, thenCommands: [oldTeleport], elseCommands: [],
      }] }],
    }];
    (files.enemies as any).slime.onDefeated = [oldTeleport];

    const result = parseSourceGame(files);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const maps = Object.values(result.data.maps);
    expect(maps.map(map => map.id)).toEqual(maps.map((_, index) => index + 1));
    expect(result.data.manifest.nextIds.maps).toBe(maps.length + 1);
    const dialogue = result.data.maps[1].events[0].pages[0].contents[0];
    expect(dialogue).toMatchObject({ choices: [{ commands: [{ thenCommands: [{
      type: 'teleport', destination: { map: { kind: 'constant', mapId: 2 }, x: { kind: 'constant', value: 2 }, y: { kind: 'constant', value: 3 } }, direction: 'retain', transition: 'instant',
    }] }] }] });
    expect(result.data.enemies[1].onDefeated).toEqual([expect.objectContaining({ type: 'teleport', direction: 'retain', transition: 'instant' })]);
  });
});

describe('V0.9 migration', () => {
  it('migrates fixed state values recursively in events and enemy commands', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    (files.manifest as any).schemaVersion = '0.9';
    (files.manifest as any).engineRange = '>=0.9 <0.10';
    (files.initialState as any).variables.score = { name: 'Score', initialValue: 0 };
    (files.maps as any).village.events[0].pages[0].contents = [{
      type: 'dialogue', speaker: 'Guide', text: 'Choose', choices: [{ label: 'Continue', commands: [{
        type: 'conditional', condition: { kind: 'switch', id: 'questAccepted', equals: true },
        thenCommands: [{ type: 'setSwitch', id: 'questAccepted', value: false }],
        elseCommands: [{ type: 'setVariable', id: 'score', value: 12 }],
      }] }],
    }];
    (files.enemies as any).slime.onDefeated = [{ type: 'setVariable', id: 'score', value: 4 }];

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest).toMatchObject({ schemaVersion: '0.16', engineRange: '>=0.16 <0.17' });
    const dialogue = result.data.maps[1].events[0].pages[0].contents[0];
    expect(dialogue).toMatchObject({ choices: [{ commands: [{
      thenCommands: [{ type: 'setSwitch', id: 1, operation: 'set', operand: { kind: 'constant', value: false } }],
      elseCommands: [{ type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'constant', value: 12 } }],
    }] }] });
    expect(result.data.enemies[1].onDefeated).toEqual([{ type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'constant', value: 4 } }]);
  });
});

describe('V0.10 migration', () => {
  it('migrates fixed switch and variable comparisons in every condition container', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    (files.manifest as any).schemaVersion = '0.10';
    (files.manifest as any).engineRange = '>=0.10 <0.11';
    (files.initialState as any).variables.score = { name: 'Score', initialValue: 0 };
    (files.maps as any).village.events[0].pages[0].conditions = [{ kind: 'variable', id: 'score', operator: 'greaterThanOrEqual', value: 3 }];
    (files.maps as any).village.events[0].pages[0].contents = [{
      type: 'conditional', condition: { kind: 'switch', id: 'questAccepted', equals: false }, thenCommands: [],
    }];
    (files.enemies as any).slime.onDefeated = [{
      type: 'conditional', condition: { kind: 'variable', id: 'score', operator: 'equal', value: 5 }, thenCommands: [],
    }];

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest).toMatchObject({ schemaVersion: '0.16', engineRange: '>=0.16 <0.17' });
    expect(result.data.maps[1].events[0].pages[0].conditions).toEqual([{ kind: 'variable', id: 1, operator: 'greaterThanOrEqual', operand: { kind: 'constant', value: 3 } }]);
    expect(result.data.maps[1].events[0].pages[0].contents[0]).toMatchObject({ condition: { kind: 'switch', id: 1, operand: { kind: 'constant', value: false } } });
    expect(result.data.enemies[1].onDefeated?.[0]).toMatchObject({ condition: { kind: 'variable', id: 1, operator: 'equal', operand: { kind: 'constant', value: 5 } } });
  });
});

describe('V0.11 migration', () => {
  it('moves equipment slots and every legacy reference into numeric equipment types', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as unknown as SourceGameFiles;
    (files.manifest as any).schemaVersion = '0.11';
    (files.manifest as any).engineRange = '>=0.11 <0.12';
    (files.ui as any).equipmentSlots = [
      { id: 'weapon', label: 'Weapon' }, { id: 'armor', label: 'Armor' }, { id: 'accessory', label: 'Accessory' },
    ];
    (files.items as any)['item.hero-sword'].equipmentSlot = 'weapon';
    delete (files.items as any)['item.hero-sword'].equipmentTypeId;
    (files.items as any)['item.leather-cloak'].equipmentSlot = 'armor';
    delete (files.items as any)['item.leather-cloak'].equipmentTypeId;
    (files.items as any)['item.orphan-charm'] = { name: 'Orphan Charm', type: 'equipment', equipmentSlot: 'trinket', stats: {} };
    (files.initialState as any).equipment = { weapon: 'item.hero-sword', armor: 'item.leather-cloak', accessory: null };

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest).toMatchObject({ schemaVersion: '0.16', engineRange: '>=0.16 <0.17' });
    expect(result.data.types.equipment).toEqual({
      nextId: 5,
      entries: [
        { id: 1, name: 'Weapon' }, { id: 2, name: 'Armor' }, { id: 3, name: 'Accessory' }, { id: 4, name: 'trinket' },
      ],
    });
    expect(result.data.items[4].equipmentTypeId).toBe(1);
    expect(result.data.items[6].equipmentTypeId).toBe(4);
    expect(result.data.initialState.equipment).toEqual({ '1': 4, '2': 5, '3': null });
    expect(result.data.ui).not.toHaveProperty('equipmentSlots');
  });
});

describe('V0.12 migration', () => {
  it('adds an empty common event catalog', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    (files.manifest as any).schemaVersion = '0.12';
    (files.manifest as any).engineRange = '>=0.12 <0.13';
    delete (files.events as any).commonEvents;

    const result = parseSourceGame(files);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest).toMatchObject({ schemaVersion: '0.16', engineRange: '>=0.16 <0.17' });
    expect(result.data.events.commonEvents).toEqual({});
  });
});

describe('V0.15 migration', () => {
  it('renames encounters and preserves combat data, rewards, positions, and backgrounds', () => {
    const current = parseSourceGame({
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles);
    expect(current.success).toBe(true);
    if (!current.success) return;
    const legacy = structuredClone(current.data) as any;
    legacy.manifest.schemaVersion = '0.15';
    legacy.manifest.engineRange = '>=0.15 <0.16';
    legacy.manifest.nextIds.encounters = 2;
    delete legacy.manifest.nextIds.troops;
    legacy.encounters = { 1: { name: 'Slime pair', enemyIds: [1, 1] } };
    delete legacy.troops;
    legacy.maps[1].encounters = { averageSteps: 20, entries: [{ encounterId: 1, weight: 3 }] };
    legacy.events.commonEvents[1] = { name: 'Fight', trigger: { type: 'none' }, contents: [{ type: 'battle', encounterId: 1 }] };
    legacy.manifest.nextIds.commonEvents = 2;
    for (const enemy of Object.values(legacy.enemies) as any[]) {
      enemy.battleSprite = enemy.image;
      enemy.hp = enemy.stats.maxHp;
      enemy.damage = enemy.stats.attack;
      enemy.xp = enemy.rewards.xp;
      delete enemy.image;
      delete enemy.stats;
      delete enemy.rewards;
    }
    delete legacy.actors.player.stats.attack;
    delete legacy.actors.player.stats.defense;
    legacy.ui.battle = { background: { lowerImage: 'battle/ground.png', upperImage: 'battle/sky.png' } };

    const result = parseSourceGame(legacy);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.manifest).toMatchObject({ schemaVersion: '0.16', engineRange: '>=0.16 <0.17', nextIds: { troops: 2 } });
    expect(result.data.troops[1]).toEqual({ name: 'Slime pair', members: [{ enemyId: 1, x: 32, y: 38 }, { enemyId: 1, x: 16, y: 47 }] });
    expect(result.data.maps[1].encounters?.entries).toEqual([{ troopId: 1, weight: 3 }]);
    expect(result.data.events.commonEvents[1].contents[0]).toEqual({ type: 'battle', troopId: 1 });
    expect(result.data.enemies[1]).toMatchObject({ image: expect.any(String), stats: { maxHp: 42, attack: 8, defense: 0 }, rewards: { xp: 7 } });
    expect(result.data.actors.player.stats).toMatchObject({ attack: 0, defense: 0 });
    expect(result.data.ui.battle?.background).toEqual({ lowerImage: 'battle/ground.png', upperImage: 'battle/sky.png' });
  });
});
