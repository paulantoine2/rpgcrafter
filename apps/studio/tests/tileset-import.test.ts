import { describe, expect, it } from 'vitest';
import { createTilesetDefinition, uniqueAssetId } from '../src/lib/tileset-import';

const variants = { '0': { quarters: [[0, 0], [1, 0], [0, 1], [1, 1]] as [[number, number], [number, number], [number, number], [number, number]] } };

describe('tileset import slicing', () => {
  it('slices every A2 block and every grid cell', () => {
    const a2 = createTilesetDefinition({ id: 'outside', name: 'Outside', category: 'Sol', format: 'a2', width: 192, height: 288, variants });
    const grid = createTilesetDefinition({ id: 'decor', name: 'Decor', category: 'Castle', format: 'grid', width: 96, height: 144 });
    expect(a2.kind).toBe('a2');
    expect(a2.terrains).toHaveLength(4);
    expect(a2.terrains.at(-1)?.origin).toEqual({ column: 2, row: 3 });
    expect(grid.kind).toBe('grid');
    expect(grid.terrains).toHaveLength(6);
    expect(grid.terrains.at(-1)?.origin).toEqual({ column: 1, row: 2 });
    expect(grid.terrains.every(terrain => terrain.collision.kind === 'none')).toBe(true);
    expect(a2.terrains.every(terrain => terrain.collision.kind === 'none')).toBe(true);
  });

  it('validates dimensions and creates collision-free ids', () => {
    expect(() => createTilesetDefinition({ id: 'bad', name: 'Bad', category: 'Sol', format: 'a2', width: 100, height: 144, variants })).toThrow(/96×144/);
    expect(uniqueAssetId('Castle Décor', ['castle-decor', 'castle-decor-2'])).toBe('castle-decor-3');
  });
});
