import type { MapEvent, PlanePosition, SourceGame } from '@rpgcrafter/game-schema';

export function createMapEventAt(game: SourceGame, mapId: number, position: PlanePosition): MapEvent {
  const map = game.maps[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  const id = map.nextEventId;
  return {
    id,
    name: `Event ${id}`,
    position,
    pages: [{
      movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
      options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
      priority: 'sameAsCharacters',
      trigger: { type: 'actionButton', radius: 1 },
      contents: [],
    }],
  };
}

export function renameMapEvent(game: SourceGame, mapId: number, eventId: number, requestedName: string): SourceGame | null {
  const name = requestedName.trim();
  const map = game.maps[mapId];
  if (!map || !name) return null;
  const eventIndex = map.events.findIndex(event => event.id === eventId);
  if (eventIndex < 0) return null;
  if (map.events[eventIndex].name === name) return game;

  const next = structuredClone(game);
  next.maps[mapId].events[eventIndex].name = name;
  return next;
}
