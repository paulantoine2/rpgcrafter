import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { SourceGame } from '@rpgcrafter/game-schema';
import { createEmptyProject, createExportArchive, openProjectArchive } from '../src/lib/source-game';

const game = {
  manifest: { gameId: 'game.test', version: '0.2.0' },
  tilesets: { test: { id: 'test', image: 'tilesets/test.png' } },
  maps: { village: { id: 'village' } },
  types: { elements: { nextId: 1, entries: [] }, skills: { nextId: 1, entries: [] }, weapons: { nextId: 1, entries: [] }, armors: { nextId: 1, entries: [] }, equipment: { nextId: 1, entries: [] } },
  events: { objectives: [] },
} as unknown as SourceGame;

function blobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsText(blob);
  });
}

describe('Studio persistence and export', () => {
  it('creates a valid project with no assets', () => {
    const project = createEmptyProject('Empty World');
    expect(project.game.manifest.schemaVersion).toBe('0.16');
    expect(project.game.manifest.combatMode).toBe('turnBased');
    expect(project.game.manifest.nextIds.maps).toBe(2);
    expect(project.game.maps[1].id).toBe(1);
    expect(project.game.tilesets).toEqual({});
    expect(project.assets).toEqual({});
    expect(project.game.types.elements.entries.map(type => type.name)).toEqual(['Physical', 'Fire', 'Ice', 'Thunder', 'Water', 'Earth', 'Wind', 'Light', 'Darkness']);
    expect(project.game.types.skills.entries.map(type => type.name)).toEqual(['Magic', 'Special']);
    expect(project.game.types.weapons.entries.at(-1)).toEqual({ id: 12, name: 'Spear' });
    expect(project.game.types.armors.entries).toHaveLength(6);
    expect(project.game.types.equipment.entries.map(type => type.name)).toEqual(['Weapon', 'Shield', 'Head', 'Body', 'Accessory']);
    expect(project.game.maps[1].planes).toHaveLength(1);
    expect(project.game.maps[1].tileLayers.map(layer => layer.renderPhase)).toEqual([
      'belowActors', 'belowActors', 'aboveActors', 'aboveActors',
    ]);
  });

  it('round-trips a complete project ZIP', async () => {
    const project = createEmptyProject('Round trip');
    project.game.actors.player.battleSprite = { image: 'battle/hero.png', frameWidth: 64, frameHeight: 64, columns: 9, rows: 6, idleFrame: { column: 3, row: 0 } };
    project.game.ui.battle = { background: { lowerImage: 'battle/ground.png', upperImage: 'battle/sky.png' } };
    project.game.tilesets.decor = {
      id: 'decor', name: 'Decor', category: 'Nature', kind: 'grid', image: 'tilesets/decor.png', tileSize: 48, columns: 1, rows: 1,
      terrains: [{ id: 'cliff', name: 'Cliff', origin: { column: 0, row: 0 }, collision: { kind: 'edges', edges: ['north', 'east'] } }],
    };
    project.assets['tilesets/decor.png'] = new Blob(['png'], { type: 'image/png' });
    project.assets['tilesets/decor.json'] = new Blob([JSON.stringify(project.game.tilesets.decor)], { type: 'application/json' });
    project.assets['sprites/rpg-maker-mz/Actor1.png'] = new Blob(['sprite'], { type: 'image/png' });
    project.assets['battle/hero.png'] = new Blob(['hero'], { type: 'image/png' });
    project.assets['battle/ground.png'] = new Blob(['ground'], { type: 'image/png' });
    project.assets['battle/sky.png'] = new Blob(['sky'], { type: 'image/png' });
    const archive = await createExportArchive(project.game, project.assets);
    const reopened = await openProjectArchive(new Blob([archive.slice().buffer], { type: 'application/zip' }));
    expect(reopened.game).toEqual(project.game);
    expect(reopened.game.tilesets.decor.terrains[0].collision).toEqual({ kind: 'edges', edges: ['north', 'east'] });
    expect(reopened.assets['tilesets/decor.png']).toBeInstanceOf(Blob);
    expect(JSON.parse(await blobText(reopened.assets['tilesets/decor.json']))).toEqual(project.game.tilesets.decor);
    expect(await blobText(reopened.assets['sprites/rpg-maker-mz/Actor1.png'])).toBe('sprite');
    expect(await blobText(reopened.assets['battle/hero.png'])).toBe('hero');
  });

  it('opens and migrates a 0.11 archive without types.json', async () => {
    const project = createEmptyProject('Legacy equipment');
    project.game.items[2] = { name: 'Sword', type: 'equipment', equipmentTypeId: 1 };
    const files = unzipSync(await createExportArchive(project.game));
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    manifest.schemaVersion = '0.11';
    manifest.engineRange = '>=0.11 <0.12';
    const ui = JSON.parse(strFromU8(files['ui.json']));
    ui.equipmentSlots = [{ id: 'weapon', label: 'Weapon' }];
    const items = JSON.parse(strFromU8(files['items.json']));
    items[2].equipmentSlot = 'weapon';
    delete items[2].equipmentTypeId;
    const initialState = JSON.parse(strFromU8(files['initial-state.json']));
    initialState.equipment = {};
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    files['ui.json'] = strToU8(JSON.stringify(ui));
    files['items.json'] = strToU8(JSON.stringify(items));
    files['initial-state.json'] = strToU8(JSON.stringify(initialState));
    delete files['types.json'];

    const reopened = await openProjectArchive(new Blob([zipSync(files).slice().buffer], { type: 'application/zip' }));

    expect(reopened.game.manifest.schemaVersion).toBe('0.16');
    expect(reopened.game.types.equipment.entries).toEqual([{ id: 1, name: 'Weapon' }]);
    expect(Object.values(reopened.game.items).find(item => item.name === 'Sword')?.equipmentTypeId).toBe(1);
  });

  it('exports a complete, self-contained project package', async () => {
    const files = unzipSync(await createExportArchive(game, { 'tilesets/test.png': new Blob(['png'], { type: 'image/png' }) }));
    expect(Object.keys(files).sort()).toEqual(['actors.json', 'enemies.json', 'events.json', 'initial-state.json', 'items.json', 'manifest.json', 'maps.json', 'quests.json', 'skills.json', 'tilesets.json', 'tilesets/test.png', 'troops.json', 'types.json', 'ui.json']);
    expect(JSON.parse(strFromU8(files['maps.json']))).toEqual(game.maps);
    expect(JSON.parse(strFromU8(files['events.json']))).toEqual(game.events);
    expect(JSON.parse(strFromU8(files['tilesets.json']))).toEqual(game.tilesets);
    expect(JSON.parse(strFromU8(files['types.json']))).toEqual(game.types);
  });
});
