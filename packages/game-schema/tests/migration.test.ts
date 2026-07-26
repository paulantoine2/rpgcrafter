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
  const legacyCommands = (commands: any[]): any[] => commands.map(command => command.type === 'dialogue' && command.choices
    ? { ...command, choices: command.choices.map((choice: any) => ({ label: choice.label, actions: legacyCommands(choice.commands) })) }
    : command);
  for (const [mapId, map] of Object.entries(legacy.maps) as Array<[string, any]>) {
    for (const event of map.events) {
      const page = event.pages[0];
      const scriptId = `event.${mapId}.${event.id}`;
      legacy.events.events[scriptId] = {
        id: scriptId,
        pages: event.pages.map((item: any) => ({
          ...(item.conditions ? { conditions: item.conditions } : {}),
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
  return legacy;
}

describe('V0.4 migration', () => {
  it('creates one bounds plane and preserves legacy map behavior', () => {
    const files: SourceGameFiles = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
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
    expect(result.data.manifest.schemaVersion).toBe('0.7');
    expect(result.data.maps.village.planes).toEqual([{ id: 'plane-1', name: 'Plan 1', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }]);
    expect(result.data.maps.village.blockedRegions[0].planeId).toBe('plane-1');
    expect(result.data.actors.player.start.planeId).toBe('plane-1');
  });
});

describe('legacy event visual migration', () => {
  it('replaces visual metadata with a sprite reference', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    const legacy = toV06(files);
    const event = legacy.maps.village.events.find((item: any) => item.id === 'mayor');
    delete event.sprite;
    event.visual = { type: 'npc', name: 'Mayor', color: '#fff', radius: 18 };

    const result = parseSourceGame(legacy);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.maps.village.events.find(item => item.id === 'mayor')?.pages[0].sprite).toMatchObject({
      image: 'sprites/rpg-maker-mz/Actor1.png',
      characterIndex: 0,
    });
  });
});

describe('V0.6 event-page migration', () => {
  it('inlines scripts without reversing page priority', () => {
    const files = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    } as SourceGameFiles;
    const legacy = toV06(files);
    const result = parseSourceGame(legacy);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const mayor = result.data.maps.village.events.find(event => event.id === 'mayor')!;
    expect(mayor.pages).toHaveLength(4);
    expect(mayor.pages[0].conditions).toEqual([{ kind: 'quest', id: 'quest.bell-of-mist', state: 'inactive' }]);
    expect(mayor.pages[0].contents[0].type).toBe('dialogue');
    expect(result.data.events).toEqual({ objectives: expect.any(Array) });
  });
});
