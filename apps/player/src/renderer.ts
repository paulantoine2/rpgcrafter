import type { Direction, GameMap, MapEvent, MapEventPage, PlanePosition, TileLayer, Vec2 } from './types.js';

const PLANE_Z_STRIDE = 1_000_000;
export function planeRenderBase(map: GameMap, planeId: string) { return (map.planes.find(plane => plane.id === planeId)?.order ?? 0) * PLANE_Z_STRIDE; }
export function actorRenderZ(map: GameMap, planeId: string, y: number) { return planeRenderBase(map, planeId) + 100_000 + y; }
export function tileLayerRenderZ(map: GameMap, layer: TileLayer, layerIndex: number) { return planeRenderBase(map, layer.planeId) + (layer.renderPhase === 'aboveActors' ? 900_000 : 0) + layerIndex; }

export type RenderEnemy = { id: string; name: string; color: string; x: number; y: number; planeId: string; radius: number; hp: number; maxHp: number; phase?: number; phases?: unknown[] };
export type RenderProjectile = { x: number; y: number; planeId: string; r: number; color: string };
export type RenderParticle = { type: string; x: number; y: number; planeId: string; t: number; color?: string; text?: string };
export type RenderEvent = Pick<MapEvent, 'id' | 'position'> & MapEventPage & {
  nearby: boolean;
  movementDirection: Direction;
  movementMoving: boolean;
  movementAnimationTime: number;
  jumpHeight: number;
};

export type RenderState = {
  map: GameMap;
  events: RenderEvent[];
  enemies: RenderEnemy[];
  projectiles: RenderProjectile[];
  particles: RenderParticle[];
  camera: Vec2;
  showTileGrid: boolean;
  player: PlanePosition & { radius: number; hp: number; maxHp: number; level: number; xp: number; invuln: number };
  playerMoving: boolean;
  playerAnimationTime: number;
  facing: Vec2;
  hud: { panel: string; text: string; health: string; slots: string[] };
};

/** A rendering boundary: game rules supply state; a renderer decides how to display it. */
export interface Renderer {
  render(state: RenderState): void;
  destroy(): void;
}
