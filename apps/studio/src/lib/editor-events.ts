import type { GameEvent, MapEvent, PlanePosition, SourceGame } from '@rpgcrafter/game-schema';

export function createMapEventAt(game: SourceGame, mapId: string, position: PlanePosition): { event: MapEvent; script: GameEvent } {
  const map = game.maps[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  const eventIds = new Set(map.events.map(event => event.id));
  const scriptIds = new Set(Object.keys(game.events.events));
  let number = 1;
  let id = `event-${number}`;
  let scriptId = `event.${mapId}.${id}`;
  while (eventIds.has(id) || scriptIds.has(scriptId)) {
    number += 1;
    id = `event-${number}`;
    scriptId = `event.${mapId}.${id}`;
  }
  return {
    event: {
      id,
      position,
      scriptId,
      trigger: { type: 'interact', radius: 1 },
      execution: { mode: 'repeat' },
      visual: { type: 'npc', name: `Event ${number}`, color: map.accent, radius: 18 },
    },
    script: { id: scriptId, pages: [{ actions: [] }] },
  };
}
