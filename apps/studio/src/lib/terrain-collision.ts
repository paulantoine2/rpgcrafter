import type { Direction, TerrainCollision } from '@rpgcrafter/game-schema';

export const COLLISION_DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];

export function toggleCellCollision(collision: TerrainCollision): TerrainCollision {
  return collision.kind === 'blockCell' ? { kind: 'none' } : { kind: 'blockCell' };
}

export function toggleEdgeCollision(collision: TerrainCollision, edge: Direction): TerrainCollision {
  const selected = new Set(collision.kind === 'edges' ? collision.edges : []);
  if (selected.has(edge)) selected.delete(edge);
  else selected.add(edge);
  const edges = COLLISION_DIRECTIONS.filter(direction => selected.has(direction));
  return edges.length ? { kind: 'edges', edges } : { kind: 'none' };
}

export function toggleA2BoundaryCollision(collision: TerrainCollision): TerrainCollision {
  return collision.kind === 'edges' && collision.edges.length
    ? { kind: 'none' }
    : { kind: 'edges', edges: [...COLLISION_DIRECTIONS] };
}

export function nearestCollisionEdge(x: number, y: number): Direction {
  const distances: Array<[Direction, number]> = [
    ['north', y],
    ['east', 1 - x],
    ['south', 1 - y],
    ['west', x],
  ];
  return distances.reduce((closest, candidate) => candidate[1] < closest[1] ? candidate : closest)[0];
}
