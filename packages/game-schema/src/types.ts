export type Vec2 = { x: number; y: number };
export type Rect = Vec2 & { w: number; h: number };
export type Direction = 'north' | 'east' | 'south' | 'west';
export type PlanePosition = Vec2 & { planeId: string };

export type Condition =
  | { kind: 'flag'; id: string; equals?: boolean }
  | { kind: 'item'; id: string; amount?: number }
  | { kind: 'quest'; id: string; state: string };

export type Action =
  | { type: 'dialogue'; speaker: string; text: string; choices?: Array<{ label: string; actions: Action[] }> }
  | { type: 'setFlag'; id: string; value: boolean }
  | { type: 'setQuestState'; id: string; state: string }
  | { type: 'giveItem' | 'removeItem'; id: string; amount?: number }
  | { type: 'unlockSkill'; id: string }
  | { type: 'healPlayer'; amount: number }
  | { type: 'toast'; text: string }
  | { type: 'teleport'; mapId: string; position: PlanePosition; resetMap: boolean }
  | { type: 'save' };

export type MapEventTrigger =
  | { type: 'playerEnter'; size: { w: number; h: number } }
  | { type: 'interact'; radius: number }
  | { type: 'interval'; every: number; initialDelay?: number }
  | { type: 'mapEnter'; delay: number };

export type MapEventExecution = { mode: 'repeat' | 'oncePerVisit' | 'oncePerGame'; cooldown?: number };
export type MapEventVisual =
  | { type: 'exit' }
  | { type: 'npc' | 'chest' | 'door'; name: string; color: string; radius: number };

export type MapEvent = {
  id: string;
  position: PlanePosition;
  scriptId: string;
  trigger: MapEventTrigger;
  execution: MapEventExecution;
  activeWhen?: Condition[];
  visual?: MapEventVisual;
};

export type EnemySpawn = PlanePosition & { enemyId: string };
export type QuarterCoordinate = [number, number];
export type AutotileVariant = { quarters: [QuarterCoordinate, QuarterCoordinate, QuarterCoordinate, QuarterCoordinate] };
export type AutotileTerrain = {
  id: string;
  name: string;
  origin: { column: number; row: number };
  previewMask: number;
  collision: TerrainCollision;
};
export type A1AnimationLayout = 'horizontal' | 'vertical' | 'none';
export type A1AutotileTerrain = AutotileTerrain & { animation: A1AnimationLayout };
export type A4AutotileTerrain = AutotileTerrain & { autotile: 'floor' | 'wall' };
export type GridTerrain = {
  id: string;
  name: string;
  origin: { column: number; row: number };
  collision: TerrainCollision;
};
export type TerrainCollision =
  | { kind: 'none' }
  | { kind: 'blockCell' }
  | { kind: 'edges'; edges: Direction[] };
export type TilesetBase = {
  id: string;
  name: string;
  category: string;
  image: string;
  tileSize: number;
  columns: number;
  rows: number;
};
export type A2TilesetDefinition = TilesetBase & {
  kind: 'a2';
  quarterSize: number;
  terrains: AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A3TilesetDefinition = TilesetBase & {
  kind: 'a3';
  quarterSize: number;
  terrains: AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A1TilesetDefinition = TilesetBase & {
  kind: 'a1';
  quarterSize: number;
  terrains: A1AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A4TilesetDefinition = TilesetBase & {
  kind: 'a4';
  quarterSize: number;
  terrains: A4AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type AutotileTilesetDefinition = A1TilesetDefinition | A2TilesetDefinition | A3TilesetDefinition | A4TilesetDefinition;
export type GridTilesetDefinition = TilesetBase & {
  kind: 'grid';
  terrains: GridTerrain[];
};
export type A5TilesetDefinition = TilesetBase & {
  kind: 'a5';
  terrains: GridTerrain[];
};
export type TilesetDefinition = AutotileTilesetDefinition | A5TilesetDefinition | GridTilesetDefinition;
export type TilesetTerrain = A1AutotileTerrain | A4AutotileTerrain | AutotileTerrain | GridTerrain;
export type TerrainPlacement = Vec2 & { tilesetId: string; terrainId: string };
export type RenderPhase = 'belowActors' | 'aboveActors';
export type SurfaceCoverage = 'bounds' | 'painted';
export type MapPlane = { id: string; name: string; order: number; surfaceLayerId: string; surfaceCoverage: SurfaceCoverage };
export type TileLayer = { id: string; name: string; planeId: string; renderPhase: RenderPhase; tiles: TerrainPlacement[] };
export type PlaneConnectionEndpoint = PlanePosition & { edge: Direction };
export type PlaneConnection = { id: string; from: PlaneConnectionEndpoint; to: PlaneConnectionEndpoint; bidirectional: boolean };
export type NavigationOverride = PlanePosition & {
  cell?: 'open' | 'blocked';
  edges?: Partial<Record<Direction, 'open' | 'blocked'>>;
};
export type BlockedRegion = Rect & { planeId: string };
export type GameMap = {
  id: string;
  name: string;
  parentMapId?: string;
  ground: string;
  accent: string;
  tileSize: number;
  bounds: Rect;
  planes: MapPlane[];
  tileLayers: TileLayer[];
  planeConnections: PlaneConnection[];
  navigationOverrides: NavigationOverride[];
  blockedRegions: BlockedRegion[];
  events: MapEvent[];
  enemySpawns: EnemySpawn[];
  deathDestination?: { mapId: string; spawn: PlanePosition };
};

export type EnemyBehavior = 'chase' | 'charge' | 'ranged' | 'boss';
export type EnemyTemplate = {
  name: string;
  color: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  behavior: EnemyBehavior;
  phases?: Array<{
    atHpRatio: number;
    speedMultiplier?: number;
    projectile?: { cooldown: number; speed: number; damage: number; color: string };
  }>;
  onDefeated?: Action[];
};

export type Skill = { name: string; type: 'melee' | 'projectile' | 'area'; damage: number; cooldown: number; range?: number; projectileSpeed?: number; color?: string };
export type Item = { name: string; type: 'quest' | 'consumable' | 'equipment'; healing?: number; equipmentSlot?: string; stats?: Record<string, number> };
export type QuestDefinition = { name: string; states: string[]; reward?: { story: string } };
export type UiDefinition = {
  theme: { fontFamily: string; pageBackground: string; panel: string; panelBorder: string; text: string; accent: string; health: string };
  hud: { slots: string[] };
  pauseMenu: { title: string; tabs: Array<{ id: string; label: string }> };
  equipmentSlots: Array<{ id: string; label: string }>;
};
export type Manifest = { schemaVersion: string; engineRange: string; gameId: string; version: string; entryPoint: { mapId: string; spawnId: string }; title: string; contentRating: string };
export type PlayerDefinition = { id: string; name: string; start: PlanePosition; stats: { maxHp: number; level: number; xp: number }; primaryAttack: string; skillSlots: Record<string, string>; unlockedSkills: string[] };
export type EventPage = { conditions?: Condition[]; actions: Action[] };
export type GameEvent = { id: string; pages: EventPage[] };
export type Objective = { conditions?: Condition[]; text: string };
export type InitialState = { flags: Record<string, boolean>; quests: Record<string, string>; inventory?: Record<string, number>; equipment?: Record<string, string | null> };
export type EventData = { events: Record<string, GameEvent>; objectives: Objective[] };

/** The exact authoring representation. Every coordinate remains in tile units. */
export type SourceGame = {
  manifest: Manifest;
  tilesets: Record<string, TilesetDefinition>;
  maps: Record<string, GameMap>;
  actors: { player: PlayerDefinition };
  enemies: Record<string, EnemyTemplate>;
  skills: Record<string, Skill>;
  items: Record<string, Item>;
  quests: Record<string, QuestDefinition>;
  ui: UiDefinition;
  events: EventData;
  initialState: InitialState;
};

export type SourceGameFiles = {
  manifest: unknown;
  tilesets: unknown;
  maps: unknown;
  actors: unknown;
  enemies: unknown;
  skills: unknown;
  items: unknown;
  quests: unknown;
  ui: unknown;
  events: unknown;
  initialState: unknown;
};

export type ContentIssue = { path: string; message: string };
export type SourceGameResult =
  | { success: true; data: SourceGame; issues: [] }
  | { success: false; issues: ContentIssue[] };
