import { describe, expect, it } from 'vitest';
import { nearestCollisionEdge, toggleA2BoundaryCollision, toggleCellCollision, toggleEdgeCollision } from '../src/lib/terrain-collision';

describe('tileset terrain collisions', () => {
  it('toggles whole-cell collisions', () => {
    expect(toggleCellCollision({ kind: 'none' })).toEqual({ kind: 'blockCell' });
    expect(toggleCellCollision({ kind: 'blockCell' })).toEqual({ kind: 'none' });
    expect(toggleCellCollision({ kind: 'edges', edges: ['north'] })).toEqual({ kind: 'blockCell' });
  });

  it('converts cells to sorted edges and returns to none after the last edge', () => {
    expect(toggleEdgeCollision({ kind: 'blockCell' }, 'west')).toEqual({ kind: 'edges', edges: ['west'] });
    expect(toggleEdgeCollision({ kind: 'edges', edges: ['south'] }, 'north')).toEqual({ kind: 'edges', edges: ['north', 'south'] });
    expect(toggleEdgeCollision({ kind: 'edges', edges: ['east'] }, 'east')).toEqual({ kind: 'none' });
  });

  it('toggles one all-sides boundary flag for A2 terrains', () => {
    expect(toggleA2BoundaryCollision({ kind: 'none' })).toEqual({ kind: 'edges', edges: ['north', 'east', 'south', 'west'] });
    expect(toggleA2BoundaryCollision({ kind: 'blockCell' })).toEqual({ kind: 'edges', edges: ['north', 'east', 'south', 'west'] });
    expect(toggleA2BoundaryCollision({ kind: 'edges', edges: ['east'] })).toEqual({ kind: 'none' });
  });

  it('selects the nearest edge using normalized tile coordinates', () => {
    expect(nearestCollisionEdge(0.5, 0.05)).toBe('north');
    expect(nearestCollisionEdge(0.95, 0.5)).toBe('east');
    expect(nearestCollisionEdge(0.5, 0.95)).toBe('south');
    expect(nearestCollisionEdge(0.05, 0.5)).toBe('west');
  });
});
