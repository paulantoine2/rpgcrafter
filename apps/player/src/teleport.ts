import type { Direction, EventCommand, GameMap, PlanePosition, Vec2 } from './types.js';

type TeleportCommand = Extract<EventCommand, { type: 'teleport' }>;

export type ResolvedTeleport = {
  mapId: number;
  position: PlanePosition;
  direction: TeleportCommand['direction'];
  transition: TeleportCommand['transition'];
};

export function resolveTeleport(command: TeleportCommand, maps: Record<number, GameMap>, variables: Record<number, number>): ResolvedTeleport | null {
  const mapSource = command.destination.map;
  const numericMapId = mapSource.kind === 'variable' ? variables[mapSource.variableId] : undefined;
  const map = mapSource.kind === 'constant' ? maps[mapSource.mapId] : numericMapId === undefined ? undefined : maps[numericMapId];
  if (!map || (numericMapId !== undefined && !Number.isInteger(numericMapId))) return null;

  const value = (source: TeleportCommand['destination']['x']) => source.kind === 'constant' ? source.value : variables[source.variableId];
  const tileX = value(command.destination.x);
  const tileY = value(command.destination.y);
  if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) return null;
  const x = (tileX + 0.5) * map.tileSize;
  const y = (tileY + 0.5) * map.tileSize;
  if (x < map.bounds.x || x >= map.bounds.x + map.bounds.w || y < map.bounds.y || y >= map.bounds.y + map.bounds.h) return null;
  const planeId = [...map.planes].sort((a, b) => a.order - b.order)[0]?.id;
  if (!planeId) return null;
  return { mapId: map.id, position: { x, y, planeId }, direction: command.direction, transition: command.transition };
}

export function teleportFacing(direction: TeleportCommand['direction'], current: Vec2): Vec2 {
  const directions: Record<Direction, Vec2> = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  };
  return direction === 'retain' ? current : directions[direction];
}

const delay = (duration: number) => new Promise<void>(resolve => setTimeout(resolve, duration));

export async function runTeleportFade(overlay: HTMLElement, color: 'black' | 'white', midpoint: () => void, wait = delay) {
  overlay.className = `teleport-transition teleport-transition-${color} teleport-transition-active`;
  await wait(300);
  midpoint();
  await wait(300);
  overlay.className = 'teleport-transition hidden';
}
