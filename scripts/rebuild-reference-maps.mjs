import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const referenceDirectory = path.join(root, 'content/reference-game');
const mapsPath = path.join(referenceDirectory, 'maps.json');
const tilesetsPath = path.join(referenceDirectory, 'tilesets.json');
const maps = JSON.parse(await readFile(mapsPath, 'utf8'));
const tilesets = JSON.parse(await readFile(tilesetsPath, 'utf8'));

const sheet = {
  a1: 'rpg-maker-mz-outside-a1', a2: 'rpg-maker-mz-outside-a2', a3: 'rpg-maker-mz-outside-a3',
  a4: 'rpg-maker-mz-outside-a4', a5: 'rpg-maker-mz-outside-a5', b: 'rpg-maker-mz-outside-b', c: 'rpg-maker-mz-outside-c',
};

function terrain(tilesetId, name, occurrence = 0) {
  const matches = tilesets[tilesetId]?.terrains.filter(item => item.name === name) || [];
  const match = matches[occurrence];
  if (!match) throw new Error(`Unknown semantic tile: ${tilesetId} / ${name} #${occurrence + 1}`);
  return { tilesetId, terrainId: match.id };
}

function setCollision(tilesetId, name, collision, occurrence) {
  const matches = tilesets[tilesetId].terrains.filter(item => item.name === name);
  const targets = occurrence === undefined ? matches : [matches[occurrence]].filter(Boolean);
  if (!targets.length) throw new Error(`Cannot configure collision for ${tilesetId} / ${name}`);
  for (const target of targets) target.collision = structuredClone(collision);
}

const none = { kind: 'none' };
const blocked = { kind: 'blockCell' };
const boundary = { kind: 'edges', edges: ['north', 'east', 'south', 'west'] };
for (const definition of Object.values(tilesets)) for (const item of definition.terrains) item.collision = structuredClone(none);
for (const name of ['Fencepost A (Wood)', 'Fencepost B (Metal)', 'Fencepost C (Stone)']) setCollision(sheet.a2, name, boundary);
for (const name of ['Hole', 'Bush', 'Bush (Dead)', 'Bush (Sand)', 'Bush (Snow)', 'Ledge']) setCollision(sheet.a2, name, blocked);
setCollision(sheet.a1, 'Pond', blocked);
for (const name of ['Roof A (Dressed Tile)', 'Roof C (Orange Tile)', 'Roof E (Wood)', 'Roof J (Temple)', 'Roof K (Stone)', 'Outer Wall B (Plaster)', 'Outer Wall C (Brick)', 'Outer Wall E (Wood)', 'Outer Wall J (Temple)', 'Outer Wall K (Rock Wall)']) setCollision(sheet.a3, name, blocked);
setCollision(sheet.a4, 'Wall I (Hedge)', blocked);
for (const name of ['Well', 'Barrel', 'Streetlight A', 'Shop Sign (Coin)', 'Rocks', 'Bridge Spar (Wood, Center A)', 'Bridge Spar (Wood, Left)', 'Bridge Spar (Wood, Center B)', 'Bridge Spar (Wood, Right)']) setCollision(sheet.b, name, blocked);
for (const name of ['Flowers A', 'Flowers B', 'Flowers C', 'Flowers D']) setCollision(sheet.b, name, none);
for (const name of ['Obelisk', 'Stone Pillar A', 'Stone Pillar B (Moss)', 'Broken Stone Pillar B (Moss)', 'Rubble B (Moss)', 'Dais']) setCollision(sheet.c, name, blocked);

const rectangle = (x, y, w, h) => Array.from({ length: h }, (_, dy) => Array.from({ length: w }, (_, dx) => ({ x: x + dx, y: y + dy }))).flat();
const horizontal = (x1, x2, y) => rectangle(x1, y, x2 - x1 + 1, 1);
const vertical = (x, y1, y2) => rectangle(x, y1, 1, y2 - y1 + 1);
const perimeter = (x, y, w, h) => [...horizontal(x, x + w - 1, y), ...horizontal(x, x + w - 1, y + h - 1), ...vertical(x, y + 1, y + h - 2), ...vertical(x + w - 1, y + 1, y + h - 2)];
const circle = (cx, cy, radius) => {
  const cells = [];
  for (let y = cy - radius; y <= cy + radius; y += 1) for (let x = cx - radius; x <= cx + radius; x += 1) {
    if (((x - cx) / radius) ** 2 + ((y - cy) / Math.max(1, radius - 2)) ** 2 <= 1) cells.push({ x, y });
  }
  return cells;
};

function layer(id, name, planeId, renderPhase) {
  return { id, name, planeId, renderPhase, tiles: [], cells: new Map() };
}

function paint(target, semanticTile, cells) {
  for (const { x, y } of cells) target.cells.set(`${x}:${y}`, { x, y, ...semanticTile });
}

function erase(target, cells) {
  for (const { x, y } of cells) target.cells.delete(`${x}:${y}`);
}

function finish(target) {
  target.tiles = [...target.cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  delete target.cells;
  return target;
}

function rebuildVillage(map) {
  const surface = layer('surface', 'Terrain naturel', 'aubeval', 'belowActors');
  const paths = layer('layer-2', 'Routes et places', 'aubeval', 'belowActors');
  const structures = layer('layer-3', 'Maisons et murs', 'aubeval', 'aboveActors');
  const details = layer('layer-4', 'Mobilier et végétation', 'aubeval', 'aboveActors');
  paint(surface, terrain(sheet.a2, 'Meadow'), rectangle(0, 0, map.bounds.w, map.bounds.h));
  paint(paths, terrain(sheet.a2, 'Road (Meadow)'), rectangle(0, 13, 45, 3));
  paint(paths, terrain(sheet.a2, 'Road (Meadow)'), rectangle(10, 5, 3, 10));
  paint(paths, terrain(sheet.a2, 'Cobblestones A'), rectangle(18, 4, 8, 7));
  paint(paths, terrain(sheet.a2, 'Road (Meadow)'), rectangle(21, 9, 2, 14));
  paint(paths, terrain(sheet.a2, 'Road (Meadow)'), rectangle(11, 9, 12, 2));

  const styles = [
    ['Roof E (Wood)', 'Outer Wall E (Wood)'], ['Roof C (Orange Tile)', 'Outer Wall C (Brick)'],
    ['Roof A (Dressed Tile)', 'Outer Wall B (Plaster)'], ['Roof K (Stone)', 'Outer Wall K (Rock Wall)'],
  ];
  map.blockedRegions.forEach((region, index) => {
    const [roofName, wallName] = styles[index % styles.length];
    paint(structures, terrain(sheet.a3, roofName), rectangle(region.x, region.y, region.w, 1));
    paint(structures, terrain(sheet.a3, wallName), rectangle(region.x, region.y + 1, region.w, region.h - 1));
  });
  paint(details, terrain(sheet.b, 'Well'), [{ x: 27, y: 8 }]);
  paint(details, terrain(sheet.b, 'Barrel'), [{ x: 27, y: 9 }, { x: 24, y: 11 }]);
  paint(details, terrain(sheet.b, 'Streetlight A'), [{ x: 17, y: 12 }, { x: 26, y: 12 }, { x: 32, y: 16 }]);
  paint(details, terrain(sheet.b, 'Shop Sign (Coin)'), [{ x: 20, y: 3 }]);
  paint(details, terrain(sheet.b, 'Flowers A'), [{ x: 2, y: 9 }, { x: 8, y: 7 }, { x: 28, y: 3 }, { x: 41, y: 10 }]);
  paint(details, terrain(sheet.b, 'Flowers B'), [{ x: 2, y: 10 }, { x: 8, y: 8 }, { x: 29, y: 3 }, { x: 42, y: 10 }]);
  paint(details, terrain(sheet.b, 'Rocks'), [{ x: 39, y: 24 }, { x: 5, y: 22 }]);
  map.ground = '#497a4f'; map.accent = '#d6b56f';
  map.tileLayers = [surface, paths, structures, details].map(finish);
}

function rebuildPath(map) {
  const trail = layer('lower-surface', 'Sentier de terre', 'lower-trail', 'belowActors');
  const trailDetails = layer('lower-fences', 'Lisière et obstacles', 'lower-trail', 'aboveActors');
  const bridge = layer('bridge-surface', 'Passerelle en bois', 'raised-bridge', 'belowActors');
  const bridgeRails = layer('bridge-fences', 'Garde-corps de la passerelle', 'raised-bridge', 'aboveActors');
  paint(trail, terrain(sheet.a2, 'Dirt (Meadow)'), rectangle(0, 7, 14, 3));
  paint(trail, terrain(sheet.a2, 'Road (Meadow)'), horizontal(0, 13, 8));
  erase(trail, [{ x: 8, y: 8 }]);
  paint(trailDetails, terrain(sheet.a2, 'Fencepost B (Metal)'), [{ x: 10, y: 7 }, { x: 10, y: 8 }]);
  paint(trailDetails, terrain(sheet.b, 'Rocks'), [{ x: 6, y: 9 }]);
  paint(trailDetails, terrain(sheet.b, 'Flowers C'), [{ x: 3, y: 6 }, { x: 12, y: 10 }]);
  for (let x = 14; x <= 26; x += 1) {
    paint(bridge, terrain(sheet.a5, 'Large Bridge (H, Top)'), [{ x, y: 7 }]);
    paint(bridge, terrain(sheet.a5, 'Large Bridge (H, Center)'), [{ x, y: 8 }]);
    paint(bridge, terrain(sheet.a5, 'Large Bridge (H, Bottom)'), [{ x, y: 9 }]);
  }
  paint(bridgeRails, terrain(sheet.b, 'Bridge Spar (Wood, Left)'), [{ x: 14, y: 7 }, { x: 14, y: 9 }]);
  paint(bridgeRails, terrain(sheet.b, 'Bridge Spar (Wood, Center A)'), horizontal(15, 20, 7));
  paint(bridgeRails, terrain(sheet.b, 'Bridge Spar (Wood, Center B)'), horizontal(15, 20, 9));
  paint(bridgeRails, terrain(sheet.b, 'Bridge Spar (Wood, Right)'), [{ x: 26, y: 7 }, { x: 26, y: 9 }]);
  map.ground = '#263f37'; map.accent = '#8bb8a3';
  map.tileLayers = [trail, trailDetails, bridge, bridgeRails].map(finish);
}

function rebuildSanctuary(map) {
  const gallery = layer('surface', 'Dallage de la galerie', 'gallery', 'belowActors');
  const galleryRuins = layer('layer-4', 'Eaux et ruines', 'gallery', 'aboveActors');
  const terrace = layer('terrace-surface', 'Sol de la terrasse', 'bell-terrace', 'belowActors');
  const parapet = layer('terrace-parapet', 'Parapets et ornements', 'bell-terrace', 'aboveActors');
  paint(gallery, terrain(sheet.a2, 'Cobblestones A'), rectangle(0, 0, map.bounds.w, map.bounds.h));
  for (const region of map.blockedRegions) paint(gallery, terrain(sheet.a1, 'Pond'), rectangle(region.x, region.y, region.w, region.h));
  paint(galleryRuins, terrain(sheet.c, 'Stone Pillar B (Moss)'), [{ x: 7, y: 2 }, { x: 10, y: 2 }, { x: 18, y: 2 }, { x: 21, y: 2 }, { x: 17, y: 10 }, { x: 21, y: 10 }]);
  paint(galleryRuins, terrain(sheet.c, 'Broken Stone Pillar B (Moss)'), [{ x: 10, y: 6 }, { x: 18, y: 5 }]);
  paint(galleryRuins, terrain(sheet.c, 'Rubble B (Moss)'), [{ x: 7, y: 6 }, { x: 21, y: 5 }, { x: 17, y: 12 }]);
  paint(terrace, terrain(sheet.a5, 'Tile Floor A'), rectangle(9, 3, 9, 6));
  paint(terrace, terrain(sheet.a2, 'Carpet'), rectangle(12, 4, 4, 3));
  erase(terrace, [{ x: 13, y: 6 }]);
  paint(parapet, terrain(sheet.a2, 'Fencepost C (Stone)'), horizontal(9, 17, 3));
  paint(parapet, terrain(sheet.a2, 'Fencepost C (Stone)'), vertical(17, 4, 8));
  paint(parapet, terrain(sheet.c, 'Stone Pillar A'), [{ x: 9, y: 3 }, { x: 17, y: 3 }, { x: 17, y: 8 }]);
  paint(parapet, terrain(sheet.c, 'Dais'), [{ x: 14, y: 4 }]);
  map.ground = '#354b52'; map.accent = '#9bbfd0';
  map.tileLayers = [gallery, galleryRuins, terrace, parapet].map(finish);
}

function rebuildArena(map) {
  const terrainLayer = layer('surface', 'Terrain du sanctuaire', 'guardian-ring', 'belowActors');
  const ring = layer('layer-2', 'Cercle de combat', 'guardian-ring', 'belowActors');
  const boundaryLayer = layer('layer-3', 'Enceinte végétale', 'guardian-ring', 'aboveActors');
  const monuments = layer('layer-4', 'Monuments du Gardien', 'guardian-ring', 'aboveActors');
  paint(terrainLayer, terrain(sheet.a2, 'Meadow'), rectangle(0, 0, map.bounds.w, map.bounds.h));
  paint(ring, terrain(sheet.a2, 'Cobblestones B'), circle(13, 7, 7));
  const enclosure = perimeter(0, 0, map.bounds.w, map.bounds.h).filter(({ x, y }) => !(y >= 7 && y <= 9 && (x === 0 || x === map.bounds.w - 1)));
  paint(boundaryLayer, terrain(sheet.a4, 'Wall I (Hedge)'), enclosure);
  paint(monuments, terrain(sheet.c, 'Stone Pillar A'), [{ x: 8, y: 3 }, { x: 18, y: 3 }, { x: 8, y: 11 }, { x: 18, y: 11 }]);
  paint(monuments, terrain(sheet.c, 'Obelisk'), [{ x: 13, y: 2 }]);
  paint(monuments, terrain(sheet.c, 'Dais'), [{ x: 13, y: 7 }]);
  map.ground = '#263d31'; map.accent = '#d4b36a';
  map.tileLayers = [terrainLayer, ring, boundaryLayer, monuments].map(finish);
}

function rebuildEmptyMap(map) {
  map.tileLayers = [
    finish(layer('surface', 'Terrain', 'empty-plane', 'belowActors')),
    finish(layer('layer-2', 'Sol et chemins', 'empty-plane', 'belowActors')),
    finish(layer('layer-3', 'Structures', 'empty-plane', 'aboveActors')),
    finish(layer('layer-4', 'Décor au premier plan', 'empty-plane', 'aboveActors')),
  ];
}

rebuildVillage(maps.village);
rebuildPath(maps.path);
rebuildSanctuary(maps.sanctuary);
rebuildArena(maps.arena);
rebuildEmptyMap(maps['empty-map']);

await writeFile(mapsPath, `${JSON.stringify(maps, null, 2)}\n`);
await writeFile(tilesetsPath, `${JSON.stringify(tilesets, null, 2)}\n`);
for (const definition of Object.values(tilesets)) {
  const file = path.join(referenceDirectory, definition.image.replace(/\.png$/i, '.json'));
  await writeFile(file, `${JSON.stringify(definition, null, 2)}\n`);
}

console.log('Rebuilt 5 reference maps exclusively from semantic tileset names.');
