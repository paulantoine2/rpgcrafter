import type { GameMap } from '@rpgcrafter/game-schema';

export type MapDropPosition = 'before' | 'inside' | 'after';
export type MapDropTarget = { id: number; position: MapDropPosition };

export function mapDropTargetForRow(mapId: number, nextSiblingId: number | undefined, verticalRatio: number): MapDropTarget {
  if (verticalRatio < 0.25) return { id: mapId, position: 'before' };
  if (verticalRatio > 0.75) return nextSiblingId ? { id: nextSiblingId, position: 'before' } : { id: mapId, position: 'after' };
  return { id: mapId, position: 'inside' };
}

function validParentId(maps: Record<number, GameMap>, map: GameMap) {
  return map.parentMapId && maps[map.parentMapId] ? map.parentMapId : null;
}

export function moveMapInHierarchy(maps: Record<number, GameMap>, mapId: number, targetMapId: number, position: MapDropPosition) {
  const map = maps[mapId];
  const target = maps[targetMapId];
  if (!map || !target || mapId === targetMapId) return maps;

  const nextParentId = position === 'inside' ? targetMapId : validParentId(maps, target);
  let ancestorId = nextParentId;
  while (ancestorId) {
    if (ancestorId === mapId) return maps;
    ancestorId = maps[ancestorId]?.parentMapId || null;
  }

  const movedMap = { ...map };
  if (nextParentId) movedMap.parentMapId = nextParentId;
  else delete movedMap.parentMapId;

  const entries = Object.entries(maps).map(([id, value]) => [Number(id), { ...value }] as [number, GameMap])
    .sort(([, a], [, b]) => (a.order ?? a.id) - (b.order ?? b.id))
    .filter(([id]) => id !== mapId);
  const targetIndex = entries.findIndex(([id]) => id === targetMapId);
  if (targetIndex < 0) return maps;
  let insertionIndex = targetIndex + (position === 'before' ? 0 : 1);
  if (position === 'inside') {
    entries.forEach(([, candidate], index) => {
      if (validParentId(maps, candidate) === targetMapId) insertionIndex = index + 1;
    });
  }
  entries.splice(insertionIndex, 0, [mapId, movedMap]);
  entries.forEach(([, value], index) => { value.order = index; });

  const nextMaps = Object.fromEntries(entries);
  const currentIds = Object.values(maps).sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id)).map(value => value.id);
  const nextIds = entries.map(([id]) => id);
  if (validParentId(maps, map) === nextParentId && currentIds.every((id, index) => id === nextIds[index])) return maps;
  return nextMaps;
}
