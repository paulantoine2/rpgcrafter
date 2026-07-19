import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSourceGame } from '@rpgcrafter/game-schema';
import { sourceGameToLoadedGame } from '../src/runtime-content.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

describe('sourceGameToLoadedGame', () => {
  it('normalizes spatial values exactly once for the Player', () => {
    const source = assertSourceGame({
      manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
      skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'),
      events: read('events.json'), initialState: read('initial-state.json'),
    });
    source.maps.village.tileLayers = [
      { id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: 'outside-a2', terrainId: 'dirt-on-grass' }] },
      { id: 'details', name: 'Details', planeId: 'aubeval', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 3, tilesetId: 'outside-a2', terrainId: 'grass' }] },
    ];
    const loaded = sourceGameToLoadedGame(source);
    expect(source.maps.village.events[1].position).toEqual({ x: 11, y: 7, planeId: 'aubeval' });
    expect(loaded.maps.village.events[1].position).toEqual({ x: 528, y: 336, planeId: 'aubeval' });
    expect(loaded.maps.village.events[1].trigger).toMatchObject({ type: 'interact', radius: 60 });
    expect(loaded.maps.village.tileLayers.map(layer => layer.tiles[0])).toEqual([
      { x: 96, y: 144, tilesetId: 'outside-a2', terrainId: 'dirt-on-grass' },
      { x: 96, y: 144, tilesetId: 'outside-a2', terrainId: 'grass' },
    ]);
    expect(loaded.maps.village.tileLayers.map(layer => layer.id)).toEqual(['ground', 'details']);
  });
});
