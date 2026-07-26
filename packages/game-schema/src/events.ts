import type { Condition, EventMovement, MapEvent, MapEventPage } from './types.js';

export type ResolvedEventPage = { page: MapEventPage; index: number };

/** Page 1 has the highest priority; the first page whose conditions pass is active. */
export function resolveEventPage(event: MapEvent, conditionsMet: (conditions: Condition[]) => boolean): ResolvedEventPage | undefined {
  const index = event.pages.findIndex(page => conditionsMet(page.conditions || []));
  return index < 0 ? undefined : { page: event.pages[index], index };
}

export function eventPageMovement(page: MapEventPage): EventMovement {
  return { ...page.movement, ...page.options };
}
