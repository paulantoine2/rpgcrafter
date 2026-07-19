import { assertSourceGame, parseSourceGame, type SourceGame, type SourceGameFiles, type SourceGameResult, type TilesetDefinition } from '@rpgcrafter/game-schema';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ProjectAssets } from '@/lib/draft-storage';
import { createDefaultMap } from '@/lib/default-map';
export { clearDraft, draftProjectId, listRecentProjects, openRecentProject, restoreDraft, restoreProjectAssets, saveDraft, saveProjectAssets, type DraftDocumentName, type ProjectAssets, type RecentProject } from '@/lib/draft-storage';

const referenceRoot = new URL('/reference-game/', window.location.origin);
const documentFiles = {
  'manifest.json': 'manifest', 'tilesets.json': 'tilesets', 'maps.json': 'maps', 'actors.json': 'actors',
  'enemies.json': 'enemies', 'skills.json': 'skills', 'items.json': 'items', 'quests.json': 'quests',
  'ui.json': 'ui', 'events.json': 'events', 'initial-state.json': 'initialState',
} as const satisfies Record<string, keyof SourceGameFiles>;

export type ProjectBundle = { game: SourceGame; assets: ProjectAssets };

function blobBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob); });
}

async function readJson(file: string): Promise<unknown> {
  const response = await fetch(new URL(file, referenceRoot));
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
  return response.json();
}

export function sourceGameFiles(game: SourceGame): SourceGameFiles {
  return {
    manifest: game.manifest, tilesets: game.tilesets, maps: game.maps, actors: game.actors, enemies: game.enemies,
    skills: game.skills, items: game.items, quests: game.quests, ui: game.ui, events: game.events, initialState: game.initialState,
  };
}

export function validateSourceGame(game: SourceGame): SourceGameResult { return parseSourceGame(sourceGameFiles(game)); }

export async function loadReferenceProject(): Promise<ProjectBundle> {
  const entries = await Promise.all(Object.entries(documentFiles).map(async ([file, key]) => [key, await readJson(file)] as const));
  const game = assertSourceGame(Object.fromEntries(entries) as unknown as SourceGameFiles);
  const assets: ProjectAssets = {};
  await Promise.all(Object.values(game.tilesets).map(async tileset => {
    const response = await fetch(new URL(tileset.image, referenceRoot));
    if (!response.ok) throw new Error(`Could not load tilesets.${tileset.id}.image (${response.status})`);
    assets[tileset.image] = await response.blob();
  }));
  return { game, assets };
}

export async function loadReferenceSourceGame(): Promise<SourceGame> { return (await loadReferenceProject()).game; }

function safeId(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
}

export function createEmptyProject(title: string, requestedId?: string): ProjectBundle {
  const gameId = `game.${safeId(requestedId || title)}`;
  const game = assertSourceGame({
    manifest: { schemaVersion: '0.6', engineRange: '>=0.6 <0.7', gameId, version: '0.1.0', entryPoint: { mapId: 'map-1', spawnId: 'spawn-1' }, title, contentRating: 'all' },
    tilesets: {},
    maps: { 'map-1': createDefaultMap('map-1', 'Map 1', 20, 15) },
    actors: { player: { id: 'player', name: 'Player', start: { x: 1.5, y: 1.5, planeId: 'plane-1' }, stats: { maxHp: 100, level: 1, xp: 0 }, primaryAttack: 'basic-attack', skillSlots: {}, unlockedSkills: ['basic-attack'] } },
    enemies: {}, skills: { 'basic-attack': { name: 'Basic attack', type: 'melee', damage: 10, cooldown: 0.4, range: 1 } }, items: {}, quests: {},
    ui: { theme: { fontFamily: 'sans-serif', pageBackground: '#0b1020', panel: '#172033', panelBorder: '#334155', text: '#f8fafc', accent: '#6ee7b7', health: '#ef4444' }, hud: { slots: ['health', 'level'] }, pauseMenu: { title: title, tabs: [{ id: 'status', label: 'Status' }] }, equipmentSlots: [] },
    events: { events: {}, objectives: [] }, initialState: { flags: {}, quests: {}, inventory: {}, equipment: {} },
  });
  return { game, assets: {} };
}

export async function openProjectArchive(file: Blob): Promise<ProjectBundle> {
  const archive = unzipSync(new Uint8Array(await blobBuffer(file)));
  const files = Object.fromEntries(Object.entries(archive).map(([path, bytes]) => [path.replace(/^\.\//, ''), bytes]));
  const source: Partial<SourceGameFiles> = {};
  for (const [fileName, key] of Object.entries(documentFiles)) {
    const bytes = files[fileName];
    if (!bytes) throw new Error(`Project package is missing ${fileName}.`);
    try { source[key] = JSON.parse(strFromU8(bytes)); } catch { throw new Error(`${fileName} is not valid JSON.`); }
  }
  const result = parseSourceGame(source as SourceGameFiles);
  if (!result.success) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
  const assets: ProjectAssets = {};
  for (const tileset of Object.values(result.data.tilesets)) {
    const bytes = files[tileset.image];
    if (!bytes) throw new Error(`Project package is missing ${tileset.image}.`);
    assets[tileset.image] = new Blob([bytes.slice().buffer], { type: 'image/png' });
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
    files[tileset.image] = new Uint8Array(await blobBuffer(blob));
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

export async function loadBundledTilesetLibrary(): Promise<Array<{ definition: TilesetDefinition; blob: Blob }>> {
  const project = await loadReferenceProject();
  const outside = project.game.tilesets['outside-a2'];
  return outside ? [{ definition: outside, blob: project.assets[outside.image] }] : [];
}
