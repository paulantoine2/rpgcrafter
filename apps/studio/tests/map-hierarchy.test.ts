import { describe, expect, it } from 'vitest';
import type { GameMap } from '@rpgcrafter/game-schema';
import { mapDropTargetForRow, moveMapInHierarchy } from '../src/lib/map-hierarchy';

const map = (id: string, parentMapId?: string) => ({ id, name: id, ...(parentMapId ? { parentMapId } : {}) }) as GameMap;

describe('moveMapInHierarchy', () => {
  it('uses one canonical target for the gap between adjacent maps', () => {
    expect(mapDropTargetForRow('a', 'b', 0.9)).toEqual({ id: 'b', position: 'before' });
    expect(mapDropTargetForRow('b', 'c', 0.1)).toEqual({ id: 'b', position: 'before' });
    expect(mapDropTargetForRow('c', undefined, 0.9)).toEqual({ id: 'c', position: 'after' });
  });

  it('moves a map inside another map', () => {
    const maps = { a: map('a'), b: map('b'), c: map('c') };
    const moved = moveMapInHierarchy(maps, 'c', 'a', 'inside');
    expect(moved.c.parentMapId).toBe('a');
    expect(Object.keys(moved)).toEqual(['a', 'c', 'b']);
  });

  it('moves a child outside its parent beside a root map', () => {
    const maps = { a: map('a'), child: map('child', 'a'), b: map('b') };
    const moved = moveMapInHierarchy(maps, 'child', 'b', 'before');
    expect(moved.child.parentMapId).toBeUndefined();
    expect(Object.keys(moved)).toEqual(['a', 'child', 'b']);
  });

  it('prevents moving a map inside one of its descendants', () => {
    const maps = { a: map('a'), child: map('child', 'a') };
    expect(moveMapInHierarchy(maps, 'a', 'child', 'inside')).toBe(maps);
  });
});
