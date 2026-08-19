import { describe, expect, it } from 'vitest';
import type { GameMap } from '@rpgcrafter/game-schema';
import { mapDropTargetForRow, moveMapInHierarchy } from '../src/lib/map-hierarchy';

const map = (id: number, parentMapId?: number) => ({ id, name: `Map ${id}`, ...(parentMapId ? { parentMapId } : {}) }) as unknown as GameMap;

describe('moveMapInHierarchy', () => {
  it('uses one canonical target for the gap between adjacent maps', () => {
    expect(mapDropTargetForRow(1, 2, 0.9)).toEqual({ id: 2, position: 'before' });
    expect(mapDropTargetForRow(2, 3, 0.1)).toEqual({ id: 2, position: 'before' });
    expect(mapDropTargetForRow(3, undefined, 0.9)).toEqual({ id: 3, position: 'after' });
  });

  it('moves a map inside another map', () => {
    const maps = { 1: map(1), 2: map(2), 3: map(3) };
    const moved = moveMapInHierarchy(maps, 3, 1, 'inside');
    expect(moved[3].parentMapId).toBe(1);
    expect(Object.keys(moved)).toEqual(['1', '2', '3']);
    expect(Object.values(moved).sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id)).map(value => value.id)).toEqual([1, 3, 2]);
  });

  it('moves a child outside its parent beside a root map', () => {
    const maps = { 1: map(1), 2: map(2, 1), 3: map(3) };
    const moved = moveMapInHierarchy(maps, 2, 3, 'before');
    expect(moved[2].parentMapId).toBeUndefined();
    expect(Object.keys(moved)).toEqual(['1', '2', '3']);
  });

  it('prevents moving a map inside one of its descendants', () => {
    const maps = { 1: map(1), 2: map(2, 1) };
    expect(moveMapInHierarchy(maps, 1, 2, 'inside')).toBe(maps);
  });
});
