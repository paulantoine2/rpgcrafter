import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSourceGame, type SourceGameFiles } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const outsideA2Id = 'rpg-maker-mz-outside-a2';
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
    expect(mayor.pages[0].trigger).toMatchObject({ type: 'actionButton', radius: 1.25 });
    const exitCommand = result.data.maps.village.events.find(event => event.id === 'exit-east')!.pages[0].contents[0];
    expect(exitCommand).toMatchObject({ type: 'teleport', mapId: 'path', position: { x: 2, y: 8, planeId: 'lower-trail' } });
  });

  it('returns structured duplicate and invalid-page issues', () => {
    const duplicate = sourceFiles();
    const maps = duplicate.maps as any;
    maps.village.events[1].id = maps.village.events[0].id;
    maps.village.events[2].pages = [];
    const result = parseSourceGame(duplicate);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('maps.village.events') }),
      expect.objectContaining({ path: 'maps.village.events.2.pages' }),
    ]));
  });

  it('validates autonomous settings and structured movement routes', () => {
    const files = sourceFiles();
    const maps = files.maps as any;
    maps.village.events[0].pages[0].movement = {
      type: 'custom', speed: 4, frequency: 3,
      route: [{ type: 'move', direction: 'forward' }, { type: 'wait', duration: 0.25 }],
    };
    maps.village.events[0].pages[0].contents.push({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 'exit-east' },
      route: {
        commands: [{ type: 'turn', direction: 'left' }, { type: 'jump', x: 1, y: 0 }],
        repeat: false, skippable: true, wait: true,
      },
    });
    const validResult = parseSourceGame(files);
    expect(validResult.success).toBe(true);

    const invalid = sourceFiles();
    const invalidMaps = invalid.maps as any;
    invalidMaps.village.events[0].pages[0].contents.push({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 'missing' },
      route: { commands: [{ type: 'move', direction: 'north' }], repeat: true, skippable: false, wait: true },
    });
    const result = parseSourceGame(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some(issue => issue.message.includes('Unknown event'))).toBe(true);
      expect(result.issues.some(issue => issue.message.includes('repeating movement route'))).toBe(true);
    }
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
    (files.maps as any).village.events[1].pages[0].trigger.radius = 0;
    const geometry = parseSourceGame(files);
    expect(geometry.success).toBe(false);

    const teleportFiles = sourceFiles();
    (teleportFiles.maps as any).village.events[0].pages[0].contents[0].resetMap = false;
    const teleport = parseSourceGame(teleportFiles);
    expect(teleport.success).toBe(false);
    if (!teleport.success) expect(teleport.issues.some(issue => issue.message.includes('current map'))).toBe(true);
  });

  it('validates authored terrain layers and tileset references', () => {
    const files = sourceFiles();
    (files.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (files.maps as any).village.tileLayers = [
      { id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'dirt-meadow' }] },
      { id: 'details', name: 'Details', planeId: 'aubeval', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'meadow' }] },
    ];
    const valid = parseSourceGame(files);
    expect(valid.success).toBe(true);

    const invalidFiles = sourceFiles();
    (invalidFiles.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (invalidFiles.maps as any).village.tileLayers = [{
      id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors',
      tiles: [
        { x: -1, y: 3, tilesetId: outsideA2Id, terrainId: 'meadow' },
        { x: -1, y: 3, tilesetId: outsideA2Id, terrainId: 'dirt-meadow' },
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
    (invalidTerrain.maps as any).village.tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'unknown' }] }];
    const terrainResult = parseSourceGame(invalidTerrain);
    expect(terrainResult.success).toBe(false);
    if (!terrainResult.success) expect(terrainResult.issues.some(issue => issue.message.includes('Unknown terrain'))).toBe(true);

    const nonInteger = sourceFiles();
    (nonInteger.maps as any).village.planes[0].surfaceLayerId = 'ground';
    (nonInteger.maps as any).village.tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2.5, y: 3, tilesetId: outsideA2Id, terrainId: 'meadow' }] }];
    const integerResult = parseSourceGame(nonInteger);
    expect(integerResult.success).toBe(false);
    if (!integerResult.success) expect(integerResult.issues.some(issue => issue.path.includes('.x'))).toBe(true);

    const duplicateLayer = sourceFiles();
    (duplicateLayer.maps as any).village.tileLayers.push({ id: 'surface', name: 'Duplicate', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [] });
    const duplicateLayerResult = parseSourceGame(duplicateLayer);
    expect(duplicateLayerResult.success).toBe(false);
    if (!duplicateLayerResult.success) expect(duplicateLayerResult.issues.some(issue => issue.message.includes('Duplicate layer id'))).toBe(true);
  });

  it('requires a complete, aligned and portable A2 definition', () => {
    const missingVariant = sourceFiles();
    delete (missingVariant.tilesets as any)[outsideA2Id].variants['255'];
    const missingResult = parseSourceGame(missingVariant);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) expect(missingResult.issues.some(issue => issue.message.includes('Missing canonical autotile mask'))).toBe(true);

    const invalidPath = sourceFiles();
    (invalidPath.tilesets as any)[outsideA2Id].image = '../outside-a2.png';
    expect(parseSourceGame(invalidPath).success).toBe(false);

    const invalidOrigin = sourceFiles();
    (invalidOrigin.tilesets as any)[outsideA2Id].terrains[0].origin.column = 1;
    const originResult = parseSourceGame(invalidOrigin);
    expect(originResult.success).toBe(false);
    if (!originResult.success) expect(originResult.issues.some(issue => issue.message.includes('align'))).toBe(true);
  });

  it('accepts aligned A1 terrains and rejects a half-block origin', () => {
    const current = parseSourceGame(sourceFiles());
    expect(current.success).toBe(true);
    if (!current.success) return;
    const animated = structuredClone(current.data);
    const tileset = (animated.tilesets as any)[outsideA2Id];
    tileset.kind = 'a1';
    tileset.columns = tileset.terrains.length * 6;
    tileset.rows = 3;
    tileset.terrains.forEach((terrain: any, index: number) => { terrain.origin = { column: index * 6, row: 0 }; terrain.animation = 'horizontal'; });
    expect(parseSourceGame(animated).success).toBe(true);

    tileset.terrains[0].origin.column = 1;
    const invalid = parseSourceGame(animated);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.some(issue => issue.message.includes('A1 origin'))).toBe(true);
  });

  it('validates paired 2×3 floor and 2×2 wall blocks in A4 definitions', () => {
    const current = parseSourceGame(sourceFiles());
    expect(current.success).toBe(true);
    if (!current.success) return;
    const game = structuredClone(current.data);
    const template = game.tilesets[outsideA2Id];
    if (template.kind !== 'a2') throw new Error('Expected an A2 template.');
    (game.tilesets as any).walls = {
      id: 'walls', name: 'Walls A4', category: 'Walls', kind: 'a4', image: 'tilesets/walls.png', tileSize: 48, quarterSize: 24, columns: 2, rows: 5,
      terrains: [
        { id: 'top', name: 'Top', origin: { column: 0, row: 0 }, previewMask: 0, autotile: 'floor', collision: { kind: 'none' } },
        { id: 'side', name: 'Side', origin: { column: 0, row: 3 }, previewMask: 0, autotile: 'wall', collision: { kind: 'none' } },
      ],
      variants: structuredClone(template.variants),
    };
    expect(parseSourceGame(game).success).toBe(true);
    (game.tilesets as any).walls.terrains[1].origin.row = 2;
    const invalid = parseSourceGame(game);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.some(issue => issue.message.includes('A4 origin'))).toBe(true);
  });

  it('validates native 2×2 A3 autotile blocks', () => {
    const current = parseSourceGame(sourceFiles());
    if (!current.success) throw new Error('Expected valid source files.');
    const game = structuredClone(current.data);
    const a3 = game.tilesets['rpg-maker-mz-outside-a3'];
    expect(a3.kind).toBe('a3');
    if (a3.kind !== 'a3') return;
    a3.terrains[0].origin.row = 1;
    const invalid = parseSourceGame(game);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.some(issue => issue.message.includes('A3 origin'))).toBe(true);
  });

  it('requires the native 8×16 dimensions for A5 regular tiles', () => {
    const current = parseSourceGame(sourceFiles());
    if (!current.success) throw new Error('Expected valid source files.');
    const game = structuredClone(current.data);
    (game.tilesets as any).floors = {
      id: 'floors', name: 'Floors A5', category: 'Floors', kind: 'a5', image: 'tilesets/floors.png', tileSize: 48, columns: 8, rows: 16,
      terrains: [{ id: 'floor', name: 'Floor', origin: { column: 0, row: 0 }, collision: { kind: 'none' } }],
    };
    expect(parseSourceGame(game).success).toBe(true);
    (game.tilesets as any).floors.columns = 7;
    const invalid = parseSourceGame(game);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.some(issue => issue.message.includes('8×16'))).toBe(true);
  });
});
