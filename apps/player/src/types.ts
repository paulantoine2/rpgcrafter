export * from '@rpgcrafter/game-schema';

import type {
  EnemyTemplate, GameEvent, GameMap, InitialState, Item, Manifest, Objective,
  NavigationGraph, PlayerDefinition, QuestDefinition, Skill, TilesetDefinition, UiDefinition,
} from '@rpgcrafter/game-schema';

/** Runtime-only representation. Spatial values have been normalized to pixels. */
export type LoadedGame = {
  manifest: Manifest;
  tilesets: Record<string, TilesetDefinition>;
  assetUrls: Record<string, string>;
  maps: Record<string, GameMap>;
  enemies: Record<string, EnemyTemplate>;
  skills: Record<string, Skill>;
  items: Record<string, Item>;
  quests: Record<string, QuestDefinition>;
  ui: UiDefinition;
  player: PlayerDefinition;
  events: Record<string, GameEvent>;
  objectives: Objective[];
  initialState: InitialState;
  /** Precomputed from authoring coordinates; cells and edges use tile coordinates. */
  navigation: Record<string, NavigationGraph>;
};
