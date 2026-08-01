import type { Condition, EventMovement, MapEvent, MapEventPage } from './types.js';

export type ResolvedEventPage = { page: MapEventPage; index: number };

/** The highest-numbered page whose conditions pass is active. */
export function resolveEventPage(event: MapEvent, conditionsMet: (conditions: Condition[]) => boolean): ResolvedEventPage | undefined {
  for (let index = event.pages.length - 1; index >= 0; index -= 1) {
    const page = event.pages[index];
    if (conditionsMet(page.conditions || [])) return { page, index };
  }
  return undefined;
}

export function eventPageMovement(page: MapEventPage): EventMovement {
  return { ...page.movement, ...page.options };
}
