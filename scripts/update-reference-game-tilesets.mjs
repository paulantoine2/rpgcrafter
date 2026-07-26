import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceDirectory = path.join(root, 'assets/tilesets/rpg-maker-mz');
const referenceDirectory = path.join(root, 'content/reference-game');
const destinationDirectory = path.join(referenceDirectory, 'tilesets/rpg-maker-mz');
const outsideSheets = ['Outside_A1', 'Outside_A2', 'Outside_A3', 'Outside_A4', 'Outside_A5', 'Outside_B', 'Outside_C'];

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const legacyTilesets = await readJson(path.join(referenceDirectory, 'tilesets.json'));
const legacyOutside = legacyTilesets['outside-a2'] || legacyTilesets['rpg-maker-mz-outside-a2'];
if (!legacyOutside) throw new Error('The reference Outside A2 tileset is unavailable.');

const definitions = Object.fromEntries(await Promise.all(outsideSheets.map(async sheet => {
  const definition = await readJson(path.join(sourceDirectory, `${sheet}.json`));
  return [definition.id, definition];
})));
const outsideA2 = definitions['rpg-maker-mz-outside-a2'];
if (!outsideA2 || outsideA2.terrains.length !== legacyOutside.terrains.length) throw new Error('Outside A2 terrain layouts do not match.');

// Keep the reference demo's authored navigation semantics while adopting the
// names and images from the bundled RPG Maker tileset.
const terrainIds = new Map();
outsideA2.terrains = outsideA2.terrains.map((terrain, index) => {
  const legacyTerrain = legacyOutside.terrains[index];
  terrainIds.set(legacyTerrain.id, terrain.id);
  return { ...terrain, collision: structuredClone(legacyTerrain.collision) };
});

const maps = await readJson(path.join(referenceDirectory, 'maps.json'));
for (const map of Object.values(maps)) {
  for (const layer of map.tileLayers) {
    const legacyTilesetId = layer.tileset;
    layer.tiles = layer.tiles.map(tile => ({
      ...tile,
      tilesetId: tile.tilesetId || (legacyTilesetId === 'outside-a2' ? outsideA2.id : legacyTilesetId),
      terrainId: legacyTilesetId === 'outside-a2' ? terrainIds.get(tile.terrainId) : tile.terrainId,
    }));
    delete layer.tileset;
  }

  const defaultPlaneId = [...map.planes].sort((a, b) => a.order - b.order)[0].id;
  while (map.tileLayers.length < 4) {
    const number = map.tileLayers.length + 1;
    map.tileLayers.push({
      id: `layer-${number}`,
      name: `Layer ${number}`,
      planeId: defaultPlaneId,
      renderPhase: number <= 2 ? 'belowActors' : 'aboveActors',
      tiles: [],
    });
  }
}

const manifest = await readJson(path.join(referenceDirectory, 'manifest.json'));
manifest.schemaVersion = '0.7';
manifest.engineRange = '>=0.7 <0.8';
manifest.version = '0.7.0';

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(outsideSheets.map(sheet => copyFile(
  path.join(sourceDirectory, `${sheet}.png`),
  path.join(destinationDirectory, `${sheet}.png`),
)));
await Promise.all(Object.values(definitions).map(definition => writeJson(
  path.join(destinationDirectory, `${path.basename(definition.image, '.png')}.json`),
  definition,
)));
await writeJson(path.join(referenceDirectory, 'tilesets.json'), definitions);
await writeJson(path.join(referenceDirectory, 'maps.json'), maps);
await writeJson(path.join(referenceDirectory, 'manifest.json'), manifest);

console.log(`Reference project updated with ${outsideSheets.length} RPG Maker tilesets and four layers per map.`);
