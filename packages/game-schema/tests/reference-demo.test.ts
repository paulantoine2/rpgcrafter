import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSourceGame, buildNavigationGraph, navigationHasCell, navigationTarget } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const referenceGame = () => assertSourceGame({
  manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
  skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'), events: read('events.json'), initialState: read('initial-state.json'),
});

describe('reference multi-plane demonstration', () => {
  it('crosses the mist trail only through its explicit connection', () => {
    const game = referenceGame(), map = game.maps.path, graph = buildNavigationGraph(map, game.tilesets);
    expect(map.planes.map(plane => plane.name)).toEqual(['Sentier des brumes', 'Passerelle ancienne']);
    expect(navigationTarget(graph, 'lower-trail', 13, 8, 'east')).toEqual({ planeId: 'raised-bridge', x: 14, y: 8 });
    expect(navigationTarget(graph, 'raised-bridge', 14, 8, 'west')).toEqual({ planeId: 'lower-trail', x: 13, y: 8 });
    expect(navigationHasCell(graph, 'lower-trail', 8, 8)).toBe(false);
    expect(navigationTarget(graph, 'lower-trail', 10, 7, 'east')).toBeNull();
    expect(navigationTarget(graph, 'lower-trail', 10, 8, 'east')).toEqual({ planeId: 'lower-trail', x: 11, y: 8 });
  });

  it('keeps the gallery and terrace independent at overlapping coordinates', () => {
    const game = referenceGame(), map = game.maps.sanctuary, graph = buildNavigationGraph(map, game.tilesets);
    expect(navigationHasCell(graph, 'gallery', 12, 5)).toBe(true);
    expect(navigationHasCell(graph, 'bell-terrace', 12, 5)).toBe(true);
    expect(navigationTarget(graph, 'gallery', 8, 8, 'east')).toEqual({ planeId: 'bell-terrace', x: 9, y: 8 });
    expect(navigationTarget(graph, 'bell-terrace', 9, 8, 'west')).toEqual({ planeId: 'gallery', x: 8, y: 8 });
    expect(navigationHasCell(graph, 'gallery', 13, 6)).toBe(true);
    expect(navigationHasCell(graph, 'bell-terrace', 13, 6)).toBe(false);
    expect(map.events.find(event => event.id === 'keyChest')?.position.planeId).toBe('bell-terrace');
    expect(map.tileLayers.find(layer => layer.id === 'terrace-parapet')?.renderPhase).toBe('aboveActors');
  });
});
