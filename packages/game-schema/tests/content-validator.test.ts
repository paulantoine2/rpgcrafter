import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSourceGame, type SourceGameFiles } from '../src/index.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const outsideA2Id = 'rpg-maker-mz-outside-a2';
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
function legacyFiles(): SourceGameFiles {
  return {
    manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
    skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'),
    events: read('events.json'), initialState: read('initial-state.json'),
  };
}

function sourceFiles(): SourceGameFiles {
  const result = parseSourceGame(legacyFiles());
  if (!result.success) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  return structuredClone(result.data);
}

describe('SourceGame validation', () => {
  it('validates troop members, positions, references, and counters', () => {
    const empty = sourceFiles();
    (empty.troops as any)[1] = { name: 'Empty troop', members: [] };
    (empty.manifest as any).nextIds.troops = 2;
    const emptyResult = parseSourceGame(empty);
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) expect(emptyResult.issues.some(issue => issue.path === 'troops.1.members')).toBe(true);

    const invalidPosition = sourceFiles();
    (invalidPosition.troops as any)[1] = { name: 'Outside', members: [{ enemyId: 1, x: 101, y: -1 }] };
    (invalidPosition.manifest as any).nextIds.troops = 2;
    const positionResult = parseSourceGame(invalidPosition);
    expect(positionResult.success).toBe(false);
    if (!positionResult.success) expect(positionResult.issues.some(issue => issue.path.startsWith('troops.1.members.0'))).toBe(true);

    const unknownEnemy = sourceFiles();
    (unknownEnemy.troops as any)[1] = { name: 'Unknown', members: [{ enemyId: 999, x: 50, y: 50 }] };
    (unknownEnemy.manifest as any).nextIds.troops = 2;
    const referenceResult = parseSourceGame(unknownEnemy);
    expect(referenceResult.success).toBe(false);
    if (!referenceResult.success) expect(referenceResult.issues.some(issue => issue.path === 'troops.1.members[0].enemyId')).toBe(true);
  });

  it('validates common event triggers and calls while allowing call cycles', () => {
    const files = sourceFiles();
    (files.events as any).commonEvents = {
      1: { name: 'First', trigger: { type: 'autorun', switchId: 1 }, contents: [{ type: 'callCommonEvent', id: 2 }] },
      2: { name: 'Second', trigger: { type: 'none' }, contents: [{ type: 'callCommonEvent', id: 1 }] },
    };
    (files.manifest as any).nextIds.commonEvents = 3;
    expect(parseSourceGame(files).success).toBe(true);

    (files.events as any).commonEvents[2].contents[0].id = 999;
    const missing = parseSourceGame(files);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.issues.some(issue => issue.message.includes('Unknown common event'))).toBe(true);
  });

  it('rejects map-event targets inside common events', () => {
    const files = sourceFiles();
    (files.events as any).commonEvents = {
      1: { name: 'Invalid', trigger: { type: 'none' }, contents: [{ type: 'movementRoute', target: { kind: 'thisEvent' }, route: { commands: [], repeat: false, skippable: false, wait: true } }] },
    };
    (files.manifest as any).nextIds.commonEvents = 2;
    const result = parseSourceGame(files);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(issue => issue.message.includes('only target the player'))).toBe(true);
  });
  it('validates type IDs, counters, and equipment type references', () => {
    const duplicate = sourceFiles();
    (duplicate.types as any).elements = { nextId: 2, entries: [{ id: 1, name: 'Fire' }, { id: 1, name: 'Ice' }] };
    const duplicateResult = parseSourceGame(duplicate);
    expect(duplicateResult.success).toBe(false);
    if (!duplicateResult.success) expect(duplicateResult.issues.some(issue => issue.message.includes('Duplicate type id'))).toBe(true);

    const invalidCounter = sourceFiles();
    (invalidCounter.types as any).equipment.nextId = 3;
    const counterResult = parseSourceGame(invalidCounter);
    expect(counterResult.success).toBe(false);
    if (!counterResult.success) expect(counterResult.issues.some(issue => issue.path === 'types.equipment.nextId')).toBe(true);

    const unknownType = sourceFiles();
    (unknownType.items as any)[4].equipmentTypeId = 999;
    const referenceResult = parseSourceGame(unknownType);
    expect(referenceResult.success).toBe(false);
    if (!referenceResult.success) expect(referenceResult.issues.some(issue => issue.path === 'items.4.equipmentTypeId')).toBe(true);
  });

  it('keeps authored coordinates in tile units', () => {
    const result = parseSourceGame(sourceFiles());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mayor = result.data.maps[1].events.find(event => event.name === 'mayor')!;
    expect(mayor.position).toEqual({ x: 11, y: 7, planeId: 'aubeval' });
    expect(mayor.pages[0].trigger).toMatchObject({ type: 'actionButton', radius: 1.25 });
    const exitCommand = result.data.maps[1].events.find(event => event.name === 'exit-east')!.pages[0].contents[0];
    expect(exitCommand).toMatchObject({ type: 'teleport', destination: { map: { kind: 'constant', mapId: 2 }, x: { kind: 'constant', value: 2 }, y: { kind: 'constant', value: 8 } }, direction: 'retain', transition: 'instant' });
  });

  it('returns structured duplicate and invalid-page issues', () => {
    const duplicate = sourceFiles();
    const maps = duplicate.maps as any;
    maps[1].events[1].id = maps[1].events[0].id;
    maps[1].events[2].pages = [];
    const result = parseSourceGame(duplicate);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringContaining('maps.1.events') }),
      expect.objectContaining({ path: 'maps.1.events.2.pages' }),
    ]));
  });

  it('rejects quest conditions', () => {
    const files = sourceFiles();
    (files.maps as any)[1].events[0].pages[0].conditions = [
      { kind: 'quest', id: 1, state: 'inactive' },
    ];

    expect(parseSourceGame(files).success).toBe(false);
  });

  it('validates numeric variable conditions and their references', () => {
    const files = sourceFiles();
    (files.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (files.manifest as any).nextIds.variables = 2;
    (files.maps as any)[1].events[0].pages[0].conditions = [
      { kind: 'variable', id: 1, operator: 'greaterThanOrEqual', operand: { kind: 'gameData', data: { kind: 'itemAmount', itemId: 3 } } },
    ];
    expect(parseSourceGame(files).success).toBe(true);

    (files.maps as any)[1].events[0].pages[0].conditions[0].id = 999;
    const result = parseSourceGame(files);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(issue => issue.message.includes('Unknown variable'))).toBe(true);
  });

  it('validates numeric map ids, their counter, and fixed teleport bounds', () => {
    const mismatchedId = sourceFiles();
    (mismatchedId.maps as any)[2].id = 1;
    const mismatchedResult = parseSourceGame(mismatchedId);
    expect(mismatchedResult.success).toBe(false);
    if (!mismatchedResult.success) expect(mismatchedResult.issues.some(issue => issue.path === 'maps.2.id')).toBe(true);

    const invalidCounter = sourceFiles();
    (invalidCounter.manifest as any).nextIds.maps = 1;
    const counterResult = parseSourceGame(invalidCounter);
    expect(counterResult.success).toBe(false);
    if (!counterResult.success) expect(counterResult.issues.some(issue => issue.path === 'manifest.nextIds.maps')).toBe(true);

    const outside = sourceFiles();
    const teleport = (outside.maps as any)[1].events.find((event: any) => event.name === 'exit-east').pages[0].contents[0];
    teleport.destination.x = { kind: 'constant', value: 999 };
    const outsideResult = parseSourceGame(outside);
    expect(outsideResult.success).toBe(false);
    if (!outsideResult.success) expect(outsideResult.issues.some(issue => issue.message.includes('inside map bounds'))).toBe(true);

    const fractional = sourceFiles();
    const fractionalTeleport = (fractional.maps as any)[1].events.find((event: any) => event.name === 'exit-east').pages[0].contents[0];
    fractionalTeleport.destination.y = { kind: 'constant', value: 3.5 };
    expect(parseSourceGame(fractional).success).toBe(false);
  });

  it('validates structured state commands, operands, and their references', () => {
    const files = sourceFiles();
    (files.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (files.manifest as any).nextIds.variables = 2;
    (files.maps as any)[1].events[0].pages[0].contents.push(
      { type: 'setSwitch', id: 1, operation: 'set', operand: { kind: 'gameData', data: { kind: 'hasItem', itemId: 3 } } },
      { type: 'setVariable', id: 1, operation: 'add', operand: { kind: 'variable', variableId: 1 } },
      { type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'random', min: 1.5, max: 4.5 } },
      { type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'event', eventId: 2 }, axis: 'x' } } },
    );
    expect(parseSourceGame(files).success).toBe(true);

    (files.maps as any)[1].events[0].pages[0].contents.at(-1).operand.data.target.eventId = 999;
    const result = parseSourceGame(files);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(issue => issue.message.includes('Unknown event'))).toBe(true);

    const invalidRange = sourceFiles();
    (invalidRange.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (invalidRange.manifest as any).nextIds.variables = 2;
    (invalidRange.maps as any)[1].events[0].pages[0].contents.push({ type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'random', min: 5, max: 1 } });
    expect(parseSourceGame(invalidRange).success).toBe(false);

    const randomComparison = sourceFiles();
    (randomComparison.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (randomComparison.manifest as any).nextIds.variables = 2;
    (randomComparison.maps as any)[1].events[0].pages[0].conditions = [
      { kind: 'variable', id: 1, operator: 'equal', operand: { kind: 'random', min: 1, max: 2 } },
    ];
    expect(parseSourceGame(randomComparison).success).toBe(false);

    const crossedTypes = sourceFiles();
    (crossedTypes.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (crossedTypes.manifest as any).nextIds.variables = 2;
    (crossedTypes.maps as any)[1].events[0].pages[0].contents.push({ type: 'setVariable', id: 1, operation: 'set', operand: { kind: 'switch', switchId: 1 } });
    expect(parseSourceGame(crossedTypes).success).toBe(false);
  });

  it('validates conditional branches, nested references and the maximum depth', () => {
    const files = sourceFiles();
    (files.initialState as any).variables[1] = { name: 'Score', initialValue: 0 };
    (files.manifest as any).nextIds.variables = 2;
    const level3 = {
      type: 'conditional',
      condition: { kind: 'item', id: 3, amount: 1 },
      thenCommands: [{ type: 'toast', text: 'Deep branch' }],
    };
    const level2 = {
      type: 'conditional',
      condition: { kind: 'variable', id: 1, operator: 'greaterThanOrEqual', operand: { kind: 'variable', variableId: 1 } },
      thenCommands: [level3],
      elseCommands: [],
    };
    (files.maps as any)[1].events[0].pages[0].contents.push({
      type: 'conditional',
      condition: { kind: 'switch', id: 1, operand: { kind: 'gameData', data: { kind: 'hasItem', itemId: 3 } } },
      thenCommands: [level2],
    });
    expect(parseSourceGame(files).success).toBe(true);

    (level3 as any).thenCommands = [{
      type: 'conditional',
      condition: { kind: 'switch', id: 999, operand: { kind: 'constant', value: true } },
      thenCommands: [],
    }];
    const result = parseSourceGame(files);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some(issue => issue.message.includes('cannot exceed 3 levels'))).toBe(true);
      expect(result.issues.some(issue => issue.message.includes('Unknown switch: 999'))).toBe(true);
    }
  });

  it('validates autonomous settings and structured movement routes', () => {
    const files = sourceFiles();
    const maps = files.maps as any;
    maps[1].events[0].pages[0].movement = {
      type: 'custom', speed: 4, frequency: 3,
      route: [{ type: 'move', direction: 'forward' }, { type: 'wait', duration: 0.25 }],
    };
    maps[1].events[0].pages[0].contents.push({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 1 },
      route: {
        commands: [{ type: 'turn', direction: 'left' }, { type: 'jump', x: 1, y: 0 }],
        repeat: false, skippable: true, wait: true,
      },
    });
    const validResult = parseSourceGame(files);
    expect(validResult.success).toBe(true);

    const invalid = sourceFiles();
    const invalidMaps = invalid.maps as any;
    invalidMaps[1].events[0].pages[0].contents.push({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 999 },
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
    (validFiles.maps as any)[2].parentMapId = 1;
    expect(parseSourceGame(validFiles).success).toBe(true);

    const missingParent = sourceFiles();
    (missingParent.maps as any)[2].parentMapId = 999;
    const missingResult = parseSourceGame(missingParent);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) expect(missingResult.issues.some(issue => issue.message.includes('Unknown parent map'))).toBe(true);

    const cycle = sourceFiles();
    (cycle.maps as any)[1].parentMapId = 2;
    (cycle.maps as any)[2].parentMapId = 1;
    const cycleResult = parseSourceGame(cycle);
    expect(cycleResult.success).toBe(false);
    if (!cycleResult.success) expect(cycleResult.issues.some(issue => issue.message.includes('cycle'))).toBe(true);
  });

  it('rejects invalid geometry and unknown teleport variables', () => {
    const files = sourceFiles();
    (files.maps as any)[1].events[1].pages[0].trigger.radius = 0;
    const geometry = parseSourceGame(files);
    expect(geometry.success).toBe(false);

    const teleportFiles = sourceFiles();
    (teleportFiles.maps as any)[1].events[0].pages[0].contents[0].destination.map = { kind: 'variable', variableId: 999 };
    const teleport = parseSourceGame(teleportFiles);
    expect(teleport.success).toBe(false);
    if (!teleport.success) expect(teleport.issues.some(issue => issue.message.includes('Unknown variable'))).toBe(true);
  });

  it('validates authored terrain layers and tileset references', () => {
    const files = sourceFiles();
    (files.maps as any)[1].planes[0].surfaceLayerId = 'ground';
    (files.maps as any)[1].tileLayers = [
      { id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'dirt-meadow' }] },
      { id: 'details', name: 'Details', planeId: 'aubeval', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'meadow' }] },
    ];
    const valid = parseSourceGame(files);
    expect(valid.success).toBe(true);

    const invalidFiles = sourceFiles();
    (invalidFiles.maps as any)[1].planes[0].surfaceLayerId = 'ground';
    (invalidFiles.maps as any)[1].tileLayers = [{
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
    (invalidTerrain.maps as any)[1].planes[0].surfaceLayerId = 'ground';
    (invalidTerrain.maps as any)[1].tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: outsideA2Id, terrainId: 'unknown' }] }];
    const terrainResult = parseSourceGame(invalidTerrain);
    expect(terrainResult.success).toBe(false);
    if (!terrainResult.success) expect(terrainResult.issues.some(issue => issue.message.includes('Unknown terrain'))).toBe(true);

    const nonInteger = sourceFiles();
    (nonInteger.maps as any)[1].planes[0].surfaceLayerId = 'ground';
    (nonInteger.maps as any)[1].tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2.5, y: 3, tilesetId: outsideA2Id, terrainId: 'meadow' }] }];
    const integerResult = parseSourceGame(nonInteger);
    expect(integerResult.success).toBe(false);
    if (!integerResult.success) expect(integerResult.issues.some(issue => issue.path.includes('.x'))).toBe(true);

    const duplicateLayer = sourceFiles();
    (duplicateLayer.maps as any)[1].tileLayers.push({ id: 'surface', name: 'Duplicate', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [] });
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
