import { describe, expect, it } from 'vitest';
import { createTilesetDefinition, uniqueAssetId } from '../src/lib/tileset-import';

const variants = { '0': { quarters: [[0, 0], [1, 0], [0, 1], [1, 1]] as [[number, number], [number, number], [number, number], [number, number]] } };

describe('tileset import slicing', () => {
  it('slices every A1–A5 block and grid cell', () => {
    const a1 = createTilesetDefinition({ id: 'water', name: 'Water', category: 'Sol', format: 'a1', width: 768, height: 576, variants });
    const a2 = createTilesetDefinition({ id: 'outside', name: 'Outside', category: 'Sol', format: 'a2', width: 192, height: 288, variants });
    const a3 = createTilesetDefinition({ id: 'buildings', name: 'Buildings', category: 'Castle', format: 'a3', width: 768, height: 384, variants });
    const a4 = createTilesetDefinition({ id: 'walls', name: 'Walls', category: 'Castle', format: 'a4', width: 768, height: 720, variants });
    const a5 = createTilesetDefinition({ id: 'floors', name: 'Floors', category: 'Castle', format: 'a5', width: 384, height: 768 });
    const grid = createTilesetDefinition({ id: 'decor', name: 'Decor', category: 'Castle', format: 'grid', width: 96, height: 144 });
    expect(a1.kind).toBe('a1');
    if (a1.kind !== 'a1') throw new Error('Expected an A1 definition.');
    expect(a1.terrains).toHaveLength(16);
    expect(a1.terrains.slice(0, 6).map(terrain => [terrain.origin, terrain.animation])).toEqual([
      [{ column: 0, row: 0 }, 'horizontal'], [{ column: 0, row: 3 }, 'horizontal'],
      [{ column: 6, row: 0 }, 'none'], [{ column: 6, row: 3 }, 'none'],
      [{ column: 8, row: 0 }, 'horizontal'], [{ column: 14, row: 0 }, 'vertical'],
    ]);
    expect(a2.kind).toBe('a2');
    expect(a2.terrains).toHaveLength(4);
    expect(a2.terrains.at(-1)?.origin).toEqual({ column: 2, row: 3 });
    expect(a3.kind).toBe('a3');
    expect(a3.terrains).toHaveLength(32);
    expect(a3.terrains.at(-1)?.origin).toEqual({ column: 14, row: 6 });
    expect(a4.kind).toBe('a4');
    if (a4.kind !== 'a4') throw new Error('Expected an A4 definition.');
    expect(a4.terrains).toHaveLength(48);
    expect(a4.terrains.slice(7, 10).map(terrain => [terrain.origin, terrain.autotile])).toEqual([
      [{ column: 14, row: 0 }, 'floor'], [{ column: 0, row: 3 }, 'wall'], [{ column: 2, row: 3 }, 'wall'],
    ]);
    expect(a4.terrains.at(-1)).toMatchObject({ origin: { column: 14, row: 13 }, autotile: 'wall' });
    expect(a5.kind).toBe('a5');
    expect(a5.terrains).toHaveLength(128);
    expect(a5.terrains.at(-1)?.origin).toEqual({ column: 7, row: 15 });
    expect(grid.kind).toBe('grid');
    expect(grid.terrains).toHaveLength(6);
    expect(grid.terrains.at(-1)?.origin).toEqual({ column: 1, row: 2 });
    expect(grid.terrains.every(terrain => terrain.collision.kind === 'none')).toBe(true);
    expect(a2.terrains.every(terrain => terrain.collision.kind === 'none')).toBe(true);
  });

  it('validates dimensions and creates collision-free ids', () => {
    expect(() => createTilesetDefinition({ id: 'bad-water', name: 'Bad water', category: 'Sol', format: 'a1', width: 576, height: 288, variants })).toThrow(/768×576/);
    expect(() => createTilesetDefinition({ id: 'bad', name: 'Bad', category: 'Sol', format: 'a2', width: 100, height: 144, variants })).toThrow(/96×144/);
    expect(() => createTilesetDefinition({ id: 'bad-roof', name: 'Bad roof', category: 'Sol', format: 'a3', width: 768, height: 576, variants })).toThrow(/768×384/);
    expect(() => createTilesetDefinition({ id: 'bad-wall', name: 'Bad wall', category: 'Sol', format: 'a4', width: 768, height: 576, variants })).toThrow(/768×720/);
    expect(() => createTilesetDefinition({ id: 'bad-floor', name: 'Bad floor', category: 'Sol', format: 'a5', width: 384, height: 720 })).toThrow(/384×768/);
    expect(uniqueAssetId('Castle Décor', ['castle-decor', 'castle-decor-2'])).toBe('castle-decor-3');
  });
});
