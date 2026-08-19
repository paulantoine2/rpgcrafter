import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBattleTestTroopId, loadStudioPreviewSource } from '../src/content-loader.js';

const root = resolve(process.cwd(), '../../content/reference-game');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const source = () => ({
  manifest: read('manifest.json'), tilesets: read('tilesets.json'), maps: read('maps.json'), actors: read('actors.json'), enemies: read('enemies.json'),
  skills: read('skills.json'), items: read('items.json'), quests: read('quests.json'), types: read('types.json'), ui: read('ui.json'),
  events: read('events.json'), initialState: read('initial-state.json'),
});

describe('Studio preview content', () => {
  it('reads a valid battle-test troop ID from the Player URL', () => {
    expect(getBattleTestTroopId('?studioPreview=1&battleTest=12')).toBe(12);
    expect(getBattleTestTroopId('?battleTest=0')).toBeNull();
    expect(getBattleTestTroopId('?battleTest=1.5')).toBeNull();
    expect(getBattleTestTroopId('?battleTest=slime')).toBeNull();
  });

  it('validates and normalizes a project received from the Studio', () => {
    const preview = source();
    preview.maps.village.planes[0].surfaceLayerId = 'ground';
    preview.maps.village.tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: 'rpg-maker-mz-outside-a2', terrainId: 'dirt-meadow' }] }];
    const loaded = loadStudioPreviewSource(preview);
    expect(loaded.maps[1].tileLayers[0].tiles[0]).toEqual({ x: 96, y: 144, tilesetId: 'rpg-maker-mz-outside-a2', terrainId: 'dirt-meadow' });
    expect(loaded.player.battleSprite?.image).toBe('battle/rpg-maker-mz/sv_actors/Actor1_1.png');
    expect(loaded.enemies[1].image).toBe('battle/rpg-maker-mz/sv_enemies/Plasma.png');
    expect(loaded.ui.battle?.background).toEqual({
      lowerImage: 'battle/rpg-maker-mz/battlebacks1/Grassland.png',
      upperImage: 'battle/rpg-maker-mz/battlebacks2/Grassland.png',
    });
  });

  it('rejects an invalid project received from the Studio', () => {
    const preview = source();
    preview.maps.village.planes[0].surfaceLayerId = 'ground';
    preview.maps.village.tileLayers = [{ id: 'ground', name: 'Ground', planeId: 'aubeval', renderPhase: 'belowActors', tiles: [{ x: 2, y: 3, tilesetId: 'rpg-maker-mz-outside-a2', terrainId: 'unknown' }] }];
    expect(() => loadStudioPreviewSource(preview)).toThrow('Invalid game package');
  });
});
