import { assertSourceGame, createDefaultGameTypes, parseSourceGame, type SourceGame, type SourceGameFiles, type SourceGameResult, type TilesetDefinition } from '@rpgcrafter/game-schema';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ProjectAssets } from '@/lib/draft-storage';
import { createDefaultMap } from '@/lib/default-map';
import { tilesetConfigurationPath } from '@/lib/tileset-import';
export { clearDraft, draftProjectId, listRecentProjects, openRecentProject, restoreDraft, restoreProjectAssets, saveDraft, saveProjectAssets, type DraftDocumentName, type ProjectAssets, type RecentProject } from '@/lib/draft-storage';

const referenceRoot = new URL('/reference-game/', window.location.origin);
const bundledTilesetJson = import.meta.glob<string>('../../../../assets/tilesets/*/*.json', { eager: true, query: '?raw', import: 'default' });
const bundledTilesetImages = import.meta.glob<string>('../../../../assets/tilesets/*/*.png', { eager: true, query: '?url', import: 'default' });
const bundledSpriteJson = import.meta.glob<string>('../../../../assets/sprites/*/*.json', { eager: true, query: '?raw', import: 'default' });
const bundledSpriteImages = import.meta.glob<string>('../../../../assets/sprites/*/*.png', { eager: true, query: '?url', import: 'default' });
const bundledBattleJson = import.meta.glob<string>('../../../../assets/battle/*/*.json', { eager: true, query: '?raw', import: 'default' });
const bundledBattleImages = import.meta.glob<string>('../../../../assets/battle/**/*.png', { eager: true, query: '?url', import: 'default' });
const documentFiles = {
  'manifest.json': 'manifest', 'tilesets.json': 'tilesets', 'maps.json': 'maps', 'actors.json': 'actors',
  'enemies.json': 'enemies', 'troops.json': 'troops', 'skills.json': 'skills', 'items.json': 'items', 'quests.json': 'quests',
  'types.json': 'types', 'ui.json': 'ui', 'events.json': 'events', 'initial-state.json': 'initialState',
} as const satisfies Record<string, keyof SourceGameFiles>;

export type ProjectBundle = { game: SourceGame; assets: ProjectAssets };
export type BundledLibraryTileset = { definition: TilesetDefinition; blob: Blob; configurationPath: string; configurationBlob: Blob; assetType: string; bundleId: string; bundleName: string; tags: string[] };
export type CharacterSpriteLayout = { format: 'rpg-maker-mz-character'; characterColumns: number; characterRows: number; characterCount: number; patterns: number; directions: string[]; frameWidth: number; frameHeight: number; objectAligned: boolean };
export type BundledLibrarySprite = { id: string; name: string; blob: Blob; imagePath: string; layout: CharacterSpriteLayout; assetType: string; bundleId: string; bundleName: string; tags: string[] };
export type BattleAssetLayout = { format: 'rpg-maker-mz-side-view-actor'; columns: number; rows: number; frameWidth: number; frameHeight: number; idleFrame: { column: number; row: number } };
export type BundledLibraryBattleAsset = { id: string; name: string; sourceUrl: string; imagePath: string; layout?: BattleAssetLayout; assetType: string; bundleId: string; bundleName: string; tags: string[] };
export type BundledLibraryBundle = { id: string; name: string; version: number; assetIds: string[] };
export type BundledTilesetLibrary = { tilesets: BundledLibraryTileset[]; sprites: BundledLibrarySprite[]; battleAssets: BundledLibraryBattleAsset[]; bundles: BundledLibraryBundle[] };

const RPG_MAKER_A1_ORIGINS = [
  [0, 0], [0, 3], [6, 0], [6, 3], [8, 0], [14, 0], [8, 3], [14, 3],
  [0, 6], [6, 6], [0, 9], [6, 9], [8, 6], [14, 6], [8, 9], [14, 9],
] as const;

export function normalizeBundledA1(definition: TilesetDefinition, variants: Extract<TilesetDefinition, { kind: 'a2' }>['variants']): TilesetDefinition {
  if (!definition.name.endsWith(' A1') || definition.kind === 'a1') return definition;
  if (definition.terrains.length !== RPG_MAKER_A1_ORIGINS.length) throw new Error(`${definition.name} must expose exactly 16 A1 terrains.`);
  return {
    ...definition, kind: 'a1', quarterSize: 24, variants: structuredClone(variants),
    terrains: definition.terrains.map((terrain, index) => ({
      ...terrain,
      origin: { column: RPG_MAKER_A1_ORIGINS[index][0], row: RPG_MAKER_A1_ORIGINS[index][1] },
      previewMask: 0,
      animation: index === 2 || index === 3 ? 'none' : index % 2 === 1 && index >= 5 ? 'vertical' : 'horizontal',
    })),
  };
}

export function normalizeBundledA3(definition: TilesetDefinition, variants: Extract<TilesetDefinition, { kind: 'a2' }>['variants']): TilesetDefinition {
  if (!definition.name.endsWith(' A3') || definition.kind === 'a3') return definition;
  if (definition.columns !== 16 || definition.rows !== 8 || definition.terrains.length !== 32) throw new Error(`${definition.name} must use the native 16×8 A3 layout.`);
  return {
    ...definition, kind: 'a3', quarterSize: 24, variants: structuredClone(variants),
    terrains: definition.terrains.map((terrain, index) => ({
      ...terrain,
      origin: { column: (index % 8) * 2, row: Math.floor(index / 8) * 2 },
      previewMask: 0,
    })),
  };
}

export function normalizeBundledA4(definition: TilesetDefinition, variants: Extract<TilesetDefinition, { kind: 'a2' }>['variants']): TilesetDefinition {
  if (!definition.name.endsWith(' A4') || definition.kind === 'a4') return definition;
  if (definition.terrains.length !== 48) throw new Error(`${definition.name} must expose exactly 48 A4 terrains.`);
  return {
    ...definition, kind: 'a4', quarterSize: 24, variants: structuredClone(variants),
    terrains: definition.terrains.map((terrain, index) => {
      const withinGroup = index % 16, wall = withinGroup >= 8;
      return {
        ...terrain,
        origin: { column: (withinGroup % 8) * 2, row: Math.floor(index / 16) * 5 + (wall ? 3 : 0) },
        previewMask: 0,
        autotile: wall ? 'wall' : 'floor',
      };
    }),
  };
}

export function normalizeBundledA5(definition: TilesetDefinition): TilesetDefinition {
  if (!definition.name.endsWith(' A5') || definition.kind === 'a5') return definition;
  if (definition.columns !== 8 || definition.rows !== 16 || definition.terrains.length !== 128) throw new Error(`${definition.name} must use the native 8×16 A5 grid.`);
  return { ...definition, kind: 'a5' };
}

function blobBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob); });
}

async function readJson(file: string): Promise<unknown> {
  const response = await fetch(new URL(file, referenceRoot));
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
  return response.json();
}

async function bundledSpriteBlob(image: string) {
  const imageEntry = Object.entries(bundledSpriteImages).find(([file]) => file.endsWith(`/assets/${image}`));
  if (!imageEntry) return null;
  const response = await fetch(imageEntry[1]);
  if (!response.ok) throw new Error(`Could not load event sprite (${image})`);
  return response.blob();
}

async function bundledBattleBlob(image: string) {
  const imageEntry = Object.entries(bundledBattleImages).find(([file]) => file.endsWith(`/assets/${image}`));
  if (!imageEntry) return null;
  const response = await fetch(imageEntry[1]);
  if (!response.ok) throw new Error(`Could not load battle asset (${image})`);
  return response.blob();
}

export function battleAssetPaths(game: SourceGame) {
  const defaultBackground = game.ui?.battle?.background;
  return [...new Set([
    ...(game.actors?.player?.battleSprite ? [game.actors.player.battleSprite.image] : []),
    ...Object.values(game.enemies || {}).flatMap(enemy => enemy.image ? [enemy.image] : []),
    ...Object.values(game.troops || {}).flatMap(troop => troop.background ? [troop.background.lowerImage, troop.background.upperImage] : []),
    ...(defaultBackground ? [defaultBackground.lowerImage, defaultBackground.upperImage] : []),
  ])];
}

export function sourceGameFiles(game: SourceGame): SourceGameFiles {
  return {
    manifest: game.manifest, tilesets: game.tilesets, maps: game.maps, actors: game.actors, enemies: game.enemies, troops: game.troops,
    skills: game.skills, items: game.items, quests: game.quests, types: game.types, ui: game.ui, events: game.events, initialState: game.initialState,
  };
}

export function validateSourceGame(game: SourceGame): SourceGameResult { return parseSourceGame(sourceGameFiles(game)); }

export async function loadReferenceProject(): Promise<ProjectBundle> {
  const entries = await Promise.all(Object.entries(documentFiles).map(async ([file, key]) => {
    if (file !== 'troops.json') return [key, await readJson(file)] as const;
    try { return [key, await readJson(file)] as const; } catch { return ['encounters', await readJson('encounters.json')] as const; }
  }));
  const game = assertSourceGame(Object.fromEntries(entries) as unknown as SourceGameFiles);
  const assets: ProjectAssets = {};
  await Promise.all(Object.values(game.tilesets).map(async tileset => {
    const response = await fetch(new URL(tileset.image, referenceRoot));
    if (!response.ok) throw new Error(`Could not load tilesets.${tileset.id}.image (${response.status})`);
    assets[tileset.image] = await response.blob();
  }));
  await Promise.all([...new Set(Object.values(game.maps).flatMap(map => map.events.flatMap(event => event.pages.flatMap(page => page.sprite ? [page.sprite.image] : []))))].map(async image => {
    const blob = await bundledSpriteBlob(image);
    if (!blob) throw new Error(`Could not find event sprite (${image})`);
    assets[image] = blob;
  }));
  await Promise.all(battleAssetPaths(game).map(async image => {
    const blob = await bundledBattleBlob(image);
    if (!blob) throw new Error(`Could not find battle asset (${image})`);
    assets[image] = blob;
  }));
  return { game, assets };
}

export async function loadTurnBasedReferenceProject(): Promise<ProjectBundle> {
  const bundle = await loadReferenceProject();
  const game = structuredClone(bundle.game);
  game.manifest.gameId = `${game.manifest.gameId}.turn-based`;
  game.manifest.title = `${game.manifest.title} — Turn-Based`;
  game.manifest.combatMode = 'turnBased';
  game.troops = {};
  let nextTroopId = 1;
  for (const map of Object.values(game.maps)) {
    const enemyIds = [...new Set(map.enemySpawns.map(spawn => spawn.enemyId))];
    const entries = enemyIds.map(enemyId => {
      const troopId = nextTroopId++;
      game.troops[troopId] = { name: game.enemies[enemyId]?.name || `Enemy ${enemyId}`, members: [{ enemyId, x: 28, y: 50 }] };
      return { troopId, weight: 1 };
    });
    map.enemySpawns = [];
    map.encounters = { averageSteps: 24, entries };
  }
  game.manifest.nextIds.troops = nextTroopId;
  return { game: assertSourceGame(sourceGameFiles(game)), assets: bundle.assets };
}

export async function loadReferenceSourceGame(): Promise<SourceGame> { return (await loadReferenceProject()).game; }

function safeId(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
}

export function createEmptyProject(title: string, requestedId?: string, combatMode: SourceGame['manifest']['combatMode'] = 'turnBased'): ProjectBundle {
  const gameId = `game.${safeId(requestedId || title)}`;
  const game = assertSourceGame({
    manifest: { schemaVersion: '0.16', engineRange: '>=0.16 <0.17', gameId, version: '0.1.0', combatMode, nextIds: { maps: 2, actors: 2, enemies: 1, troops: 1, skills: 2, items: 1, quests: 1, commonEvents: 1, switches: 1, variables: 1 }, entryPoint: { mapId: 1, spawnId: 'spawn-1' }, title, contentRating: 'all' },
    tilesets: {},
    maps: { 1: createDefaultMap(1, 'Map 1', 20, 15) },
    actors: { player: { id: 1, name: 'Player', start: { x: 1.5, y: 1.5, planeId: 'plane-1' }, stats: { maxHp: 100, attack: 0, defense: 0, level: 1, xp: 0 }, primaryAttack: 1, skillSlots: {}, unlockedSkills: [1] } },
    enemies: {}, troops: {}, skills: { 1: { name: 'Basic attack', type: 'melee', damage: 10, cooldown: 0.4, range: 1 } }, items: {}, quests: {},
    types: createDefaultGameTypes(),
    ui: { theme: { fontFamily: 'sans-serif', pageBackground: '#0b1020', panel: '#172033', panelBorder: '#334155', text: '#f8fafc', accent: '#6ee7b7', health: '#ef4444' }, hud: { slots: ['health', 'level'] }, pauseMenu: { title: title, tabs: [{ id: 'status', label: 'Status' }] } },
    events: { objectives: [], commonEvents: {} }, initialState: { switches: {}, variables: {}, quests: {}, inventory: {}, equipment: {} },
  });
  return { game, assets: {} };
}

export async function openProjectArchive(file: Blob): Promise<ProjectBundle> {
  const archive = unzipSync(new Uint8Array(await blobBuffer(file)));
  const files = Object.fromEntries(Object.entries(archive).map(([path, bytes]) => [path.replace(/^\.\//, ''), bytes]));
  const source: Partial<SourceGameFiles> = {};
  for (const [fileName, key] of Object.entries(documentFiles)) {
    const legacyEncounterFile = fileName === 'troops.json' ? files['encounters.json'] : undefined;
    const bytes = files[fileName] || legacyEncounterFile;
    if (!bytes && fileName === 'types.json') continue;
    if (!bytes) throw new Error(`Project package is missing ${fileName}.`);
    try {
      const value = JSON.parse(strFromU8(bytes));
      if (legacyEncounterFile) (source as unknown as Record<string, unknown>).encounters = value;
      else source[key] = value;
    } catch { throw new Error(`${legacyEncounterFile ? 'encounters.json' : fileName} is not valid JSON.`); }
  }
  const result = parseSourceGame(source as SourceGameFiles);
  if (!result.success) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  const assets: ProjectAssets = {};
  for (const [assetPath, bytes] of Object.entries(files)) {
    if (assetPath in documentFiles || assetPath === 'encounters.json' || assetPath.endsWith('/')) continue;
    if (assetPath.startsWith('/') || assetPath.includes('\\') || assetPath.split('/').includes('..')) throw new Error(`Invalid project asset path: ${assetPath}`);
    const type = assetPath.toLowerCase().endsWith('.png') ? 'image/png' : assetPath.toLowerCase().endsWith('.json') ? 'application/json' : 'application/octet-stream';
    assets[assetPath] = new Blob([bytes.slice().buffer], { type });
  }
  for (const tileset of Object.values(result.data.tilesets)) {
    if (!assets[tileset.image]) throw new Error(`Project package is missing ${tileset.image}.`);
  }
  for (const sprite of Object.values(result.data.maps).flatMap(map => map.events.flatMap(event => event.pages.flatMap(page => page.sprite ? [page.sprite] : [])))) {
    if (!assets[sprite.image]) {
      const bundled = await bundledSpriteBlob(sprite.image);
      if (!bundled) throw new Error(`Project package is missing ${sprite.image}.`);
      assets[sprite.image] = bundled;
    }
  }
  for (const image of battleAssetPaths(result.data)) {
    if (!assets[image]) {
      const bundled = await bundledBattleBlob(image);
      if (!bundled) throw new Error(`Project package is missing ${image}.`);
      assets[image] = bundled;
    }
  }
  return { game: result.data, assets };
}

export async function createExportArchive(game: SourceGame, assets: ProjectAssets = {}) {
  const source = sourceGameFiles(game) as Record<keyof SourceGameFiles, unknown>;
  const files: Record<string, Uint8Array> = {};
  for (const [fileName, key] of Object.entries(documentFiles)) files[fileName] = strToU8(`${JSON.stringify(source[key], null, 2)}\n`);
  for (const tileset of Object.values(game.tilesets)) {
    const blob = assets[tileset.image];
    if (!blob) throw new Error(`Tileset image is unavailable: ${tileset.image}`);
  }
  for (const sprite of Object.values(game.maps).flatMap(map => (map.events || []).flatMap(event => event.pages.flatMap(page => page.sprite ? [page.sprite] : [])))) {
    if (!assets[sprite.image]) throw new Error(`Event sprite is unavailable: ${sprite.image}`);
  }
  for (const image of battleAssetPaths(game)) if (!assets[image]) throw new Error(`Battle asset is unavailable: ${image}`);
  for (const [assetPath, blob] of Object.entries(assets)) {
    if (assetPath.startsWith('/') || assetPath.includes('\\') || assetPath.split('/').includes('..') || assetPath in documentFiles) throw new Error(`Invalid project asset path: ${assetPath}`);
    files[assetPath] = new Uint8Array(await blobBuffer(blob));
  }
  return zipSync(files, { level: 6 });
}

export async function exportGamePackage(game: SourceGame, assets: ProjectAssets) {
  const archive = await createExportArchive(game, assets);
  const blob = new Blob([archive.slice().buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${game.manifest.gameId.replace(/[^a-z0-9.-]+/gi, '-')}.zip`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function loadBundledTilesetLibrary(): Promise<BundledTilesetLibrary> {
  const libraryEntries = Object.entries(bundledTilesetJson).filter(([file]) => file.endsWith('/library.json'));
  if (!libraryEntries.length) throw new Error('No bundled tileset library manifests are available.');
  const a2Template = Object.values(bundledTilesetJson).map(source => { try { return JSON.parse(source) as TilesetDefinition; } catch { return null; } }).find(definition => definition?.kind === 'a2');
  if (!a2Template || a2Template.kind !== 'a2') throw new Error('The bundled A2 autotile recipes are unavailable.');
  const catalogs = await Promise.all(libraryEntries.map(async ([, source]) => {
    const manifest = JSON.parse(source) as { id?: string; name?: string; version?: number; assets?: Array<{ id: string; type: string; tags: string[]; configuration: string; image: string }> };
    if (!manifest.id || !manifest.name || !Number.isInteger(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.some(asset => !asset.id || !asset.type || !Array.isArray(asset.tags) || !asset.configuration || !asset.image)) throw new Error('A bundled tileset library manifest is invalid.');
    const tilesets = await Promise.all(manifest.assets.map(async item => {
      const configurationEntry = Object.entries(bundledTilesetJson).find(([file]) => file.endsWith(`/assets/${item.configuration}`));
      const imageEntry = Object.entries(bundledTilesetImages).find(([file]) => file.endsWith(`/assets/${item.image}`));
      if (!configurationEntry || !imageEntry) throw new Error(`The bundled tileset is incomplete: ${item.image}`);
      const definition = normalizeBundledA5(normalizeBundledA4(normalizeBundledA3(normalizeBundledA1(JSON.parse(configurationEntry[1]) as TilesetDefinition, a2Template.variants), a2Template.variants), a2Template.variants));
      const configurationSource = `${JSON.stringify(definition, null, 2)}\n`;
      const response = await fetch(imageEntry[1]);
      if (!response.ok) throw new Error(`Could not load bundled tileset ${definition.id} (${response.status})`);
      return {
        definition,
        blob: await response.blob(),
        configurationPath: item.configuration,
        configurationBlob: new Blob([configurationSource], { type: 'application/json' }),
        assetType: item.type,
        bundleId: manifest.id!,
        bundleName: manifest.name!,
        tags: item.tags,
      };
    }));
    return {
      tilesets,
      bundle: { id: manifest.id, name: manifest.name, version: manifest.version!, assetIds: manifest.assets.map(asset => asset.id) },
    };
  }));
  const tilesets = catalogs.flatMap(catalog => catalog.tilesets);
  if (new Set(tilesets.map(asset => asset.definition.id)).size !== tilesets.length) throw new Error('Bundled tileset ids must be unique across libraries.');
  const spriteCatalogs = await Promise.all(Object.entries(bundledSpriteJson).filter(([file]) => file.endsWith('/library.json')).map(async ([, source]) => {
    const manifest = JSON.parse(source) as { id?: string; name?: string; version?: number; assets?: Array<{ id: string; name: string; type: string; tags: string[]; image: string; layout: CharacterSpriteLayout }> };
    const invalidLayout = (layout: CharacterSpriteLayout | undefined) => !layout || layout.format !== 'rpg-maker-mz-character' || !Number.isInteger(layout.characterColumns) || !Number.isInteger(layout.characterRows) || !Number.isInteger(layout.characterCount) || !Number.isInteger(layout.patterns) || !Array.isArray(layout.directions) || !Number.isFinite(layout.frameWidth) || !Number.isFinite(layout.frameHeight) || typeof layout.objectAligned !== 'boolean';
    if (!manifest.id || !manifest.name || !Number.isInteger(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.some(asset => !asset.id || !asset.name || !asset.type || !Array.isArray(asset.tags) || !asset.image || invalidLayout(asset.layout))) throw new Error('A bundled sprite library manifest is invalid.');
    const sprites = await Promise.all(manifest.assets.map(async item => {
      const imageEntry = Object.entries(bundledSpriteImages).find(([file]) => file.endsWith(`/assets/${item.image}`));
      if (!imageEntry) throw new Error(`The bundled sprite is incomplete: ${item.image}`);
      const response = await fetch(imageEntry[1]);
      if (!response.ok) throw new Error(`Could not load bundled sprite ${item.id} (${response.status})`);
      return {
        id: item.id,
        name: item.name,
        blob: await response.blob(),
        imagePath: item.image,
        layout: item.layout,
        assetType: item.type,
        bundleId: manifest.id!,
        bundleName: manifest.name!,
        tags: item.tags,
      };
    }));
    return { sprites, bundle: { id: manifest.id, name: manifest.name, version: manifest.version!, assetIds: manifest.assets.map(asset => asset.id) } };
  }));
  const sprites = spriteCatalogs.flatMap(catalog => catalog.sprites);
  const battleCatalogs = await Promise.all(Object.entries(bundledBattleJson).filter(([file]) => file.endsWith('/library.json')).map(async ([, source]) => {
    const manifest = JSON.parse(source) as { id?: string; name?: string; version?: number; assets?: Array<{ id: string; name: string; type: string; tags: string[]; image: string; layout?: BattleAssetLayout }> };
    const invalidLayout = (layout: BattleAssetLayout | undefined) => layout !== undefined && (layout.format !== 'rpg-maker-mz-side-view-actor' || !Number.isInteger(layout.columns) || !Number.isInteger(layout.rows) || !Number.isInteger(layout.frameWidth) || !Number.isInteger(layout.frameHeight) || !Number.isInteger(layout.idleFrame?.column) || !Number.isInteger(layout.idleFrame?.row));
    if (!manifest.id || !manifest.name || !Number.isInteger(manifest.version) || !Array.isArray(manifest.assets) || manifest.assets.some(asset => !asset.id || !asset.name || !asset.type || !Array.isArray(asset.tags) || !asset.image || invalidLayout(asset.layout))) throw new Error('A bundled battle asset library manifest is invalid.');
    const battleAssets = manifest.assets.map(item => {
      const imageEntry = Object.entries(bundledBattleImages).find(([file]) => file.endsWith(`/assets/${item.image}`));
      if (!imageEntry) throw new Error(`The bundled battle asset is incomplete: ${item.image}`);
      return { id: item.id, name: item.name, sourceUrl: imageEntry[1], imagePath: item.image, layout: item.layout, assetType: item.type, bundleId: manifest.id!, bundleName: manifest.name!, tags: item.tags };
    });
    return { battleAssets, bundle: { id: manifest.id, name: manifest.name, version: manifest.version!, assetIds: manifest.assets.map(asset => asset.id) } };
  }));
  const battleAssets = battleCatalogs.flatMap(catalog => catalog.battleAssets);
  const allIds = [...tilesets.map(asset => asset.definition.id), ...sprites.map(asset => asset.id), ...battleAssets.map(asset => asset.id)];
  if (new Set(allIds).size !== allIds.length) throw new Error('Bundled asset ids must be unique across libraries.');
  const bundlesById = new Map<string, BundledLibraryBundle>();
  for (const bundle of [...catalogs.map(catalog => catalog.bundle), ...spriteCatalogs.map(catalog => catalog.bundle), ...battleCatalogs.map(catalog => catalog.bundle)]) {
    const existing = bundlesById.get(bundle.id);
    if (!existing) { bundlesById.set(bundle.id, { ...bundle }); continue; }
    if (existing.name !== bundle.name || existing.version !== bundle.version) throw new Error(`Bundled asset manifests disagree about bundle ${bundle.id}.`);
    existing.assetIds.push(...bundle.assetIds);
  }
  return { tilesets, sprites, battleAssets, bundles: [...bundlesById.values()] };
}
