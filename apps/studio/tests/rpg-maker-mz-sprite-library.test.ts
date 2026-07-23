import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type SpriteAsset = {
  id: string;
  image: string;
  layout: {
    characterColumns: number;
    characterRows: number;
    characterCount: number;
    patterns: number;
    directions: string[];
    frameWidth: number;
    frameHeight: number;
    objectAligned: boolean;
  };
};

const projectRoot = resolve(process.cwd(), '../..');
const library = JSON.parse(readFileSync(resolve(projectRoot, 'assets/sprites/rpg-maker-mz/library.json'), 'utf8')) as { assets: SpriteAsset[] };

function pngDimensions(path: string) {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('RPG Maker MZ sprite library', () => {
  it('catalogs every supplied sheet with unique ids and valid frame dimensions', () => {
    expect(library.assets).toHaveLength(45);
    expect(new Set(library.assets.map(asset => asset.id)).size).toBe(library.assets.length);
    for (const asset of library.assets) {
      const imagePath = resolve(projectRoot, 'assets', asset.image);
      expect(existsSync(imagePath), asset.image).toBe(true);
      const dimensions = pngDimensions(imagePath);
      expect(dimensions.width).toBe(asset.layout.characterColumns * asset.layout.patterns * asset.layout.frameWidth);
      expect(dimensions.height).toBe(asset.layout.characterRows * asset.layout.directions.length * asset.layout.frameHeight);
      expect(asset.layout.characterCount).toBe(asset.layout.characterColumns * asset.layout.characterRows);
    }
  });

  it('preserves native multi-character, single-character, and object layouts', () => {
    const actor = library.assets.find(asset => asset.image.endsWith('/Actor1.png'))!;
    const gate = library.assets.find(asset => asset.image.endsWith('/!$Gate1.png'))!;
    const crystal = library.assets.find(asset => asset.image.endsWith('/!Crystal.png'))!;
    expect(actor.layout).toMatchObject({ characterCount: 8, frameWidth: 48, frameHeight: 48, objectAligned: false });
    expect(gate.layout).toMatchObject({ characterCount: 1, frameWidth: 144, frameHeight: 96, objectAligned: true });
    expect(crystal.layout).toMatchObject({ characterCount: 8, frameWidth: 48, frameHeight: 96, objectAligned: true });
  });
});
