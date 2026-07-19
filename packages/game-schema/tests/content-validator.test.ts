import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSourceGame, type SourceGameFiles } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
function sourceFiles(): SourceGameFiles {
  return {
    manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
    skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), ui: read('ui.json'),
    events: read('events.json'), initialState: read('initial-state.json'),
  };
}

describe('SourceGame validation', () => {
  it('keeps authored coordinates in tile units', () => {
    const result = parseSourceGame(sourceFiles());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mayor = result.data.maps.village.events.find(event => event.id === 'mayor')!;
    expect(mayor.position).toEqual({ x: 11, y: 7, planeId: 'aubeval' });
    expect(mayor.trigger).toMatchObject({ type: 'interact', radius: 1.25 });
    const exitAction = result.data.events.events['event.exit-village-east'].pages[0].actions[0];
    expect(exitAction).toMatchObject({ type: 'teleport', mapId: 'path', position: { x: 2, y: 8, planeId: 'lower-trail' } });
  });

  it('returns structured duplicate and unknown-script issues', () => {
    const duplicate = sourceFiles();
    const maps = duplicate.maps as any;
    maps.village.events[1].id = maps.village.events[0].id;
    maps.village.events[2].scriptId = 'event.unknown';
    const result = parseSourceGame(duplicate);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('maps.village.events') }),
      expect.objectContaining({ path: 'maps.village.events[2].scriptId' }),
    ]));
  });

  it('validates map hierarchy parents and cycles', () => {
    const validFiles = sourceFiles();
    (validFiles.maps as any).path.parentMapId = 'village';
    expect(parseSourceGame(validFiles).success).toBe(true);

    const missingParent = sourceFiles();
    (missingParent.maps as any).path.parentMapId = 'missing';
    const missingResult = parseSourceGame(missingParent);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) expect(missingResult.issues.some(issue => issue.message.includes('Unknown parent map'))).toBe(true);

    const cycle = sourceFiles();
    (cycle.maps as any).village.parentMapId = 'path';
    (cycle.maps as any).path.parentMapId = 'village';
    const cycleResult = parseSourceGame(cycle);
    expect(cycleResult.success).toBe(false);
    if (!cycleResult.success) expect(cycleResult.issues.some(issue => issue.message.includes('cycle'))).toBe(true);
  });

  it('rejects invalid geometry and cross-map local teleports', () => {
    const files = sourceFiles();
    (files.maps as any).village.events[1].trigger.radius = 0;
    const geometry = parseSourceGame(files);
    expect(geometry.success).toBe(false);

    const teleportFiles = sourceFiles();
    (teleportFiles.events as any).events['event.exit-village-east'].pages[0].actions[0].resetMap = false;
    const teleport = parseSourceGame(teleportFiles);
    expect(teleport.success).toBe(false);
    if (!teleport.success) expect(teleport.issues.some(issue => issue.message.includes('current map'))).toBe(true);
  });

  it('validates authored terrain layers and tileset references', () => {
    const files = sourceFiles();
    (files.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (files.maps as any).village.tileLayers = [
      { id: 'ground', name: 'Ground', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, terrainId: 'dirt-on-grass' }] },
      { id: 'details', name: 'Details', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 3, terrainId: 'grass' }] },
    ];
    const valid = parseSourceGame(files);
    expect(valid.success).toBe(true);

    const invalidFiles = sourceFiles();
    (invalidFiles.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (invalidFiles.maps as any).village.tileLayers = [{
      id: 'ground', name: 'Ground', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'belowActors',
      tiles: [
        { x: -1, y: 3, terrainId: 'grass' },
        { x: -1, y: 3, terrainId: 'dirt-on-grass' },
      ],
    }];
    const invalid = parseSourceGame(invalidFiles);
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.issues.some(issue => issue.message.includes('inside map bounds'))).toBe(true);
      expect(invalid.issues.some(issue => issue.message.includes('Duplicate tile position'))).toBe(true);
    }

    const invalidTerrain = sourceFiles();
    (invalidTerrain.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (invalidTerrain.maps as any).village.tileLayers = [{ id: 'ground', name: 'Ground', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, terrainId: 'unknown' }] }];
    const terrainResult = parseSourceGame(invalidTerrain);
    expect(terrainResult.success).toBe(false);
    if (!terrainResult.success) expect(terrainResult.issues.some(issue => issue.message.includes('Unknown terrain'))).toBe(true);

    const nonInteger = sourceFiles();
    (nonInteger.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (nonInteger.maps as any).village.tileLayers = [{ id: 'ground', name: 'Ground', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2.5, y: 3, terrainId: 'grass' }] }];
    const integerResult = parseSourceGame(nonInteger);
    expect(integerResult.success).toBe(false);
    if (!integerResult.success) expect(integerResult.issues.some(issue => issue.path.includes('.x'))).toBe(true);

    const duplicateLayer = sourceFiles();
    (duplicateLayer.maps as any).village.tileLayers.push({ id: 'surface', name: 'Duplicate', tileset: 'outside-a2', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [] });
    const duplicateLayerResult = parseSourceGame(duplicateLayer);
    expect(duplicateLayerResult.success).toBe(false);
    if (!duplicateLayerResult.success) expect(duplicateLayerResult.issues.some(issue => issue.message.includes('Duplicate layer id'))).toBe(true);
  });

  it('requires a complete, aligned and portable A2 definition', () => {
    const missingVariant = sourceFiles();
    delete (missingVariant.tilesets as any)['outside-a2'].variants['255'];
    const missingResult = parseSourceGame(missingVariant);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) expect(missingResult.issues.some(issue => issue.message.includes('Missing canonical autotile mask'))).toBe(true);

    const invalidPath = sourceFiles();
    (invalidPath.tilesets as any)['outside-a2'].image = '../outside-a2.png';
    expect(parseSourceGame(invalidPath).success).toBe(false);

    const invalidOrigin = sourceFiles();
    (invalidOrigin.tilesets as any)['outside-a2'].terrains[0].origin.column = 1;
    const originResult = parseSourceGame(invalidOrigin);
    expect(originResult.success).toBe(false);
    if (!originResult.success) expect(originResult.issues.some(issue => issue.message.includes('align'))).toBe(true);
  });
});
