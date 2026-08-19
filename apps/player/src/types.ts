export * from '@rpgcrafter/game-schema';

import type {
  CommonEvent, Troop, EnemyTemplate, GameMap, GameTypes, InitialState, Item, Manifest, Objective,
  NavigationGraph, PlayerDefinition, QuestDefinition, Skill, TilesetDefinition, UiDefinition,
} from '@rpgcrafter/game-schema';

/** Runtime-only representation. Spatial values have been normalized to pixels. */
export type LoadedGame = {
  manifest: Manifest;
  tilesets: Record<string, TilesetDefinition>;
  assetUrls: Record<string, string>;
  maps: Record<number, GameMap>;
  enemies: Record<number, EnemyTemplate>;
  troops: Record<number, Troop>;
  skills: Record<number, Skill>;
  items: Record<number, Item>;
  quests: Record<number, QuestDefinition>;
  types: GameTypes;
  ui: UiDefinition;
  player: PlayerDefinition;
  objectives: Objective[];
  commonEvents: Record<number, CommonEvent>;
  initialState: InitialState;
  /** Precomputed from authoring coordinates; cells and edges use tile coordinates. */
  navigation: Record<number, NavigationGraph>;
};
