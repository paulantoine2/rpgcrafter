import { assertSourceGame, type SourceGameFiles } from '@rpgcrafter/game-schema';
import { sourceGameToLoadedGame } from './runtime-content.js';
import type { LoadedGame } from './types.js';

const bundledSpriteImages = import.meta.glob<string>('../../../assets/sprites/*/*.png', { eager: true, query: '?url', import: 'default' });

async function readJson(file: string): Promise<unknown> {
  const response = await fetch(new URL(file, new URL('/reference-game/', window.location.origin)));
  if (!response.ok) throw new Error(`Impossible de charger ${file} (${response.status})`);
  return response.json();
}

export async function loadReferenceGame(): Promise<LoadedGame> {
  const [manifest, tilesets, maps, enemies, actors, skills, items, quests, ui, eventData, initialState] = await Promise.all([
    readJson('manifest.json'), readJson('tilesets.json'), readJson('maps.json'), readJson('enemies.json'), readJson('actors.json'), readJson('skills.json'),
    readJson('items.json'), readJson('quests.json'), readJson('ui.json'), readJson('events.json'), readJson('initial-state.json')
  ]);
  const source = assertSourceGame({ manifest, tilesets, maps, enemies, actors, skills, items, quests, ui, events: eventData, initialState });
  const loaded = sourceGameToLoadedGame(source);
  loaded.assetUrls = Object.fromEntries(Object.values(source.tilesets).map(tileset => [tileset.image, new URL(tileset.image, new URL('/reference-game/', window.location.origin)).href]));
  for (const image of new Set(Object.values(source.maps).flatMap(map => map.events.flatMap(event => event.sprite ? [event.sprite.image] : [])))) {
    const imageEntry = Object.entries(bundledSpriteImages).find(([file]) => file.endsWith(`/assets/${image}`));
    if (!imageEntry) throw new Error(`Le sprite d’événement est introuvable (${image})`);
    loaded.assetUrls[image] = imageEntry[1];
  }
  return loaded;
}

export function loadStudioPreviewSource(source: unknown, assets: Record<string, Blob> = {}): LoadedGame {
  const loaded = sourceGameToLoadedGame(assertSourceGame(source as SourceGameFiles));
  loaded.assetUrls = Object.fromEntries(Object.entries(assets).map(([path, blob]) => [path, URL.createObjectURL(blob)]));
  return loaded;
}

async function loadStudioPreviewGame(): Promise<LoadedGame> {
  const params = new URLSearchParams(window.location.search);
  const studioOrigin = params.get('studioOrigin');
  const opener = window.opener;
  if (!studioOrigin || !opener) throw new Error('Le Studio ayant ouvert cet aperçu est indisponible.');

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(readyInterval);
      window.removeEventListener('message', onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== opener || event.origin !== studioOrigin || event.data?.type !== 'rpgcrafter-studio-preview') return;
      try {
        const content = loadStudioPreviewSource(event.data.game, event.data.assets);
        cleanup();
        resolve(content);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const announceReady = () => opener.postMessage({ type: 'rpgcrafter-player-ready' }, studioOrigin);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Le Player n’a reçu aucun projet du Studio.'));
    }, 15_000);
    const readyInterval = window.setInterval(announceReady, 500);
    window.addEventListener('message', onMessage);
    announceReady();
  });
}

export function isStudioPreview() {
  return new URLSearchParams(window.location.search).get('studioPreview') === '1';
}

export function loadGameContent(): Promise<LoadedGame> {
  return isStudioPreview() ? loadStudioPreviewGame() : loadReferenceGame();
}
