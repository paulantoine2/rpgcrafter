import { describe, expect, it } from 'vitest';
import type { TilesetDefinition } from '@rpgcrafter/game-schema';
import { createEmptyProject, normalizeBundledA1, normalizeBundledA3, normalizeBundledA4, normalizeBundledA5, validateSourceGame } from '../src/lib/source-game';

const configurationSources = import.meta.glob<string>('../../../assets/tilesets/rpg-maker-mz/*.json', { eager: true, query: '?raw', import: 'default' });

describe('RPG Maker MZ asset package', () => {
  it('contains valid English-only sidecar configurations for every manifest entry', () => {
    const manifestSource = Object.entries(configurationSources).find(([file]) => file.endsWith('/library.json'))?.[1];
    expect(manifestSource).toBeTruthy();
    const manifest = JSON.parse(manifestSource!) as { assets: Array<{ id: string; type: string; tags: string[]; configuration: string }> };
    expect(manifest.assets).toHaveLength(31);

    for (const asset of manifest.assets) {
      expect(asset.type).toBe('tileset');
      expect(asset.tags.length).toBeGreaterThan(1);
      expect(asset).not.toHaveProperty('category');
      const source = Object.entries(configurationSources).find(([file]) => file.endsWith(`/${asset.configuration.split('/').at(-1)}`))?.[1];
      expect(source, asset.configuration).toBeTruthy();
      expect(source).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
      const definition = JSON.parse(source!) as TilesetDefinition;
      expect(definition.id).toBe(asset.id);
      const suffix = /-(a[1-5]|b|c)$/.exec(definition.id)?.[1];
      expect(definition.kind).toBe(suffix === 'b' || suffix === 'c' ? 'grid' : suffix);
      expect(definition.terrains.every(terrain => terrain.collision.kind === 'none')).toBe(true);
      const project = createEmptyProject('MZ validation');
      project.game.tilesets[definition.id] = definition;
      expect(validateSourceGame(project.game)).toMatchObject({ success: true });
    }
  });

  it('keeps A3 roof and wall sheets as native 2×2 autotiles', () => {
    const source = (suffix: string) => Object.entries(configurationSources).find(([file]) => file.endsWith(suffix))?.[1];
    const definition = JSON.parse(source('/Outside_A3.json')!) as TilesetDefinition;
    const a2 = JSON.parse(source('/Outside_A2.json')!) as TilesetDefinition;
    if (a2.kind !== 'a2') throw new Error('Expected an A2 recipe source.');
    const normalized = normalizeBundledA3(definition, a2.variants);
    expect(normalized.kind).toBe('a3');
    expect(normalized.terrains).toHaveLength(32);
    expect(normalized.terrains.at(-1)).toMatchObject({ origin: { column: 14, row: 6 }, previewMask: 0 });
    const project = createEmptyProject('A3 validation');
    project.game.tilesets[normalized.id] = normalized;
    expect(validateSourceGame(project.game)).toMatchObject({ success: true });
  });

  it('maps legacy bundled A1 sidecars to the 16 native MZ terrain slots', () => {
    const source = (suffix: string) => Object.entries(configurationSources).find(([file]) => file.endsWith(suffix))?.[1];
    const legacyA1 = JSON.parse(source('/World_A1.json')!) as TilesetDefinition;
    const a2 = JSON.parse(source('/World_A2.json')!) as TilesetDefinition;
    expect(a2.kind).toBe('a2');
    if (a2.kind !== 'a2') return;
    const normalized = normalizeBundledA1(legacyA1, a2.variants);
    expect(normalized.kind).toBe('a1');
    if (normalized.kind !== 'a1') return;
    expect(normalized.terrains.map(terrain => [terrain.origin.column, terrain.origin.row, terrain.animation])).toEqual([
      [0, 0, 'horizontal'], [0, 3, 'horizontal'], [6, 0, 'none'], [6, 3, 'none'],
      [8, 0, 'horizontal'], [14, 0, 'vertical'], [8, 3, 'horizontal'], [14, 3, 'vertical'],
      [0, 6, 'horizontal'], [6, 6, 'vertical'], [0, 9, 'horizontal'], [6, 9, 'vertical'],
      [8, 6, 'horizontal'], [14, 6, 'vertical'], [8, 9, 'horizontal'], [14, 9, 'vertical'],
    ]);
    const project = createEmptyProject('A1 validation');
    project.game.tilesets[normalized.id] = normalized;
    expect(validateSourceGame(project.game)).toMatchObject({ success: true });
  });

  it('maps legacy bundled A4 sidecars to alternating floor and wall autotiles', () => {
    const source = (suffix: string) => Object.entries(configurationSources).find(([file]) => file.endsWith(suffix))?.[1];
    const legacyA4 = JSON.parse(source('/Inside_A4.json')!) as TilesetDefinition;
    const a2 = JSON.parse(source('/Inside_A2.json')!) as TilesetDefinition;
    if (a2.kind !== 'a2') throw new Error('Expected an A2 recipe source.');
    const normalized = normalizeBundledA4(legacyA4, a2.variants);
    expect(normalized.kind).toBe('a4');
    if (normalized.kind !== 'a4') return;
    expect(normalized.terrains).toHaveLength(48);
    expect(normalized.terrains[0]).toMatchObject({ origin: { column: 0, row: 0 }, autotile: 'floor' });
    expect(normalized.terrains[8]).toMatchObject({ origin: { column: 0, row: 3 }, autotile: 'wall' });
    expect(normalized.terrains[47]).toMatchObject({ origin: { column: 14, row: 13 }, autotile: 'wall' });
    const project = createEmptyProject('A4 validation');
    project.game.tilesets[normalized.id] = normalized;
    expect(validateSourceGame(project.game)).toMatchObject({ success: true });
  });

  it('maps legacy bundled A5 sidecars to native regular-tile sheets', () => {
    const source = Object.entries(configurationSources).find(([file]) => file.endsWith('/Inside_A5.json'))?.[1];
    const normalized = normalizeBundledA5(JSON.parse(source!) as TilesetDefinition);
    expect(normalized).toMatchObject({ kind: 'a5', columns: 8, rows: 16 });
    expect(normalized.terrains).toHaveLength(128);
    const project = createEmptyProject('A5 validation');
    project.game.tilesets[normalized.id] = normalized;
    expect(validateSourceGame(project.game)).toMatchObject({ success: true });
  });
});
