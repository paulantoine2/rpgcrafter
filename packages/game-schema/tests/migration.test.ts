import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSourceGame, type SourceGameFiles } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

describe('V0.4 migration', () => {
  it('creates one bounds plane and preserves legacy map behavior', () => {
    const files: SourceGameFiles = {
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
    };
    const legacy = structuredClone(files) as any;
    legacy.manifest.schemaVersion = '0.4'; legacy.manifest.engineRange = '>=0.4 <0.5';
    for (const map of Object.values(legacy.maps) as any[]) {
      map.obstacles = map.blockedRegions.map(({ planeId: _planeId, ...region }: any) => region);
      delete map.planes; delete map.planeConnections; delete map.navigationOverrides; delete map.blockedRegions;
      map.tileLayers.forEach((layer: any) => { delete layer.planeId; delete layer.renderPhase; });
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
    expect(result.data.manifest.schemaVersion).toBe('0.6');
    expect(result.data.maps.village.planes).toEqual([{ id: 'plane-1', name: 'Plan 1', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }]);
    expect(result.data.maps.village.blockedRegions[0].planeId).toBe('plane-1');
    expect(result.data.actors.player.start.planeId).toBe('plane-1');
  });
});
