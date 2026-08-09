import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { SourceGame } from '@rpgcrafter/game-schema';
import { createEmptyProject, createExportArchive, openProjectArchive } from '../src/lib/source-game';

const game = {
  manifest: { gameId: 'game.test', version: '0.2.0' },
  tilesets: { test: { id: 'test', image: 'tilesets/test.png' } },
  maps: { village: { id: 'village' } },
  events: { objectives: [] },
} as unknown as SourceGame;

function blobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsText(blob);
  });
}

describe('Studio persistence and export', () => {
  it('creates a valid project with no assets', () => {
    const project = createEmptyProject('Empty World');
    expect(project.game.manifest.schemaVersion).toBe('0.11');
    expect(project.game.manifest.nextMapNumericId).toBe(2);
    expect(project.game.maps['map-1'].numericId).toBe(1);
    expect(project.game.tilesets).toEqual({});
    expect(project.assets).toEqual({});
    expect(project.game.maps['map-1'].planes).toHaveLength(1);
    expect(project.game.maps['map-1'].tileLayers.map(layer => layer.renderPhase)).toEqual([
      'belowActors', 'belowActors', 'aboveActors', 'aboveActors',
    ]);
  });

  it('round-trips a complete project ZIP', async () => {
    const project = createEmptyProject('Round trip');
    project.game.tilesets.decor = {
      id: 'decor', name: 'Decor', category: 'Nature', kind: 'grid', image: 'tilesets/decor.png', tileSize: 48, columns: 1, rows: 1,
      terrains: [{ id: 'cliff', name: 'Cliff', origin: { column: 0, row: 0 }, collision: { kind: 'edges', edges: ['north', 'east'] } }],
    };
    project.assets['tilesets/decor.png'] = new Blob(['png'], { type: 'image/png' });
    project.assets['tilesets/decor.json'] = new Blob([JSON.stringify(project.game.tilesets.decor)], { type: 'application/json' });
    project.assets['sprites/rpg-maker-mz/Actor1.png'] = new Blob(['sprite'], { type: 'image/png' });
    const archive = await createExportArchive(project.game, project.assets);
    const reopened = await openProjectArchive(new Blob([archive.slice().buffer], { type: 'application/zip' }));
    expect(reopened.game).toEqual(project.game);
    expect(reopened.game.tilesets.decor.terrains[0].collision).toEqual({ kind: 'edges', edges: ['north', 'east'] });
    expect(reopened.assets['tilesets/decor.png']).toBeInstanceOf(Blob);
    expect(JSON.parse(await blobText(reopened.assets['tilesets/decor.json']))).toEqual(project.game.tilesets.decor);
    expect(await blobText(reopened.assets['sprites/rpg-maker-mz/Actor1.png'])).toBe('sprite');
  });

  it('exports a complete, self-contained project package', async () => {
    const files = unzipSync(await createExportArchive(game, { 'tilesets/test.png': new Blob(['png'], { type: 'image/png' }) }));
    expect(Object.keys(files).sort()).toEqual(['actors.json', 'enemies.json', 'events.json', 'initial-state.json', 'items.json', 'manifest.json', 'maps.json', 'quests.json', 'skills.json', 'tilesets.json', 'tilesets/test.png', 'ui.json']);
    expect(JSON.parse(strFromU8(files['maps.json']))).toEqual(game.maps);
    expect(JSON.parse(strFromU8(files['events.json']))).toEqual(game.events);
    expect(JSON.parse(strFromU8(files['tilesets.json']))).toEqual(game.tilesets);
  });
});
