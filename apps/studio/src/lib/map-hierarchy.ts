import type { GameMap } from '@rpgcrafter/game-schema';

export type MapDropPosition = 'before' | 'inside' | 'after';
export type MapDropTarget = { id: string; position: MapDropPosition };

export function mapDropTargetForRow(mapId: string, nextSiblingId: string | undefined, verticalRatio: number): MapDropTarget {
  if (verticalRatio < 0.25) return { id: mapId, position: 'before' };
  if (verticalRatio > 0.75) return nextSiblingId ? { id: nextSiblingId, position: 'before' } : { id: mapId, position: 'after' };
  return { id: mapId, position: 'inside' };
}

function validParentId(maps: Record<string, GameMap>, map: GameMap) {
  return map.parentMapId && maps[map.parentMapId] ? map.parentMapId : null;
}

export function moveMapInHierarchy(maps: Record<string, GameMap>, mapId: string, targetMapId: string, position: MapDropPosition) {
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

  const entries = Object.entries(maps).filter(([id]) => id !== mapId);
  const targetIndex = entries.findIndex(([id]) => id === targetMapId);
  if (targetIndex < 0) return maps;
  let insertionIndex = targetIndex + (position === 'before' ? 0 : 1);
  if (position === 'inside') {
    entries.forEach(([, candidate], index) => {
      if (validParentId(maps, candidate) === targetMapId) insertionIndex = index + 1;
    });
  }
  entries.splice(insertionIndex, 0, [mapId, movedMap]);

  const nextMaps = Object.fromEntries(entries);
  const currentIds = Object.keys(maps);
  const nextIds = Object.keys(nextMaps);
  if (validParentId(maps, map) === nextParentId && currentIds.every((id, index) => id === nextIds[index])) return maps;
  return nextMaps;
}
