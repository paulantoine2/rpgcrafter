import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceDirectory = path.resolve(process.argv[2] || '');
const outputDirectory = path.resolve('assets/tilesets/rpg-maker-mz');
const referenceDefinitionPath = path.resolve('content/reference-game/tilesets.json');

if (!process.argv[2]) throw new Error('Usage: node scripts/generate-rpg-maker-mz-assets.mjs <RPG Maker MZ tileset directory>');

const dimensionsBySuffix = {
  A1: { columns: 16, rows: 12 },
  A2: { columns: 16, rows: 12 },
  A3: { columns: 16, rows: 8 },
  A4: { columns: 16, rows: 15 },
  A5: { columns: 8, rows: 16 },
  B: { columns: 16, rows: 16 },
  C: { columns: 16, rows: 16 },
};

function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tile';
}

function assetParts(fileName) {
  const stem = fileName.replace(/\.png$/i, '');
  const match = /^(.*)_(A[1-5]|B|C)$/.exec(stem);
  if (!match) throw new Error(`Unsupported RPG Maker MZ tileset name: ${fileName}`);
  return { stem, family: match[1], suffix: match[2] };
}

function englishNames(contents) {
  return contents.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((line, index) => {
    const name = line.split('|', 1)[0].replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}].*$/u, '').trim();
    if (!name) throw new Error(`Missing English name on line ${index + 1}`);
    return name;
  });
}

function uniqueTerrainIds(names) {
  const counts = new Map();
  return names.map(name => {
    const base = slug(name);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

function logicalOrigins(suffix, count) {
  if (suffix === 'A1') {
    const origins = [
      [0, 0], [0, 3], [6, 0], [6, 3], [8, 0], [14, 0], [8, 3], [14, 3],
      [0, 6], [6, 6], [0, 9], [6, 9], [8, 6], [14, 6], [8, 9], [14, 9],
    ];
    if (count !== origins.length) throw new Error(`A1 TXT must contain ${origins.length} names, received ${count}`);
    return origins;
  }
  if (suffix === 'A2') return Array.from({ length: count }, (_, index) => [(index % 8) * 2, Math.floor(index / 8) * 3]);
  if (suffix === 'A3') return Array.from({ length: count }, (_, index) => [(index % 8) * 2, Math.floor(index / 8) * 2]);
  if (suffix === 'A4') return Array.from({ length: count }, (_, index) => {
    const group = Math.floor(index / 16);
    const withinGroup = index % 16;
    return [(withinGroup % 8) * 2, group * 5 + (withinGroup < 8 ? 0 : 3)];
  });
  const columns = dimensionsBySuffix[suffix].columns;
  return Array.from({ length: count }, (_, index) => [index % columns, Math.floor(index / columns)]);
}

function familyName(value) {
  return value.replace(/^SF_/, 'Science Fiction ').replaceAll('_', ' ');
}

function assetTags(family, suffix, names) {
  const tags = new Set([suffix.toLowerCase(), ['A1', 'A2', 'A3', 'A4'].includes(suffix) ? 'autotile' : 'grid']);
  const familyTags = {
    Dungeon: ['dungeon', 'inside'],
    Inside: ['fantasy', 'inside'],
    Outside: ['fantasy', 'outside'],
    SF_Inside: ['sci-fi', 'inside'],
    SF_Outside: ['sci-fi', 'outside'],
    World: ['overworld', 'world-map'],
  };
  for (const tag of familyTags[family] || []) tags.add(tag);
  const content = names.join(' ').toLowerCase();
  const contentTags = [
    ['snow', /snow|ice|frozen/], ['desert', /desert|sand/], ['jungle', /jungle|palm|tropical/],
    ['water', /water|sea|river|pond|ocean/], ['lava', /lava/], ['castle', /castle|fortress/],
    ['urban', /building|asphalt|traffic|apartment/],
  ];
  for (const [tag, pattern] of contentTags) if (pattern.test(content)) tags.add(tag);
  return [...tags];
}

const referenceDefinitions = JSON.parse(await readFile(referenceDefinitionPath, 'utf8'));
const variants = referenceDefinitions['outside-a2']?.variants;
if (!variants) throw new Error('The reference A2 autotile recipes are unavailable.');

const pngNames = (await readdir(sourceDirectory)).filter(name => name.toLowerCase().endsWith('.png')).sort((a, b) => a.localeCompare(b));
if (!pngNames.length) throw new Error(`No PNG tilesets found in ${sourceDirectory}`);

await mkdir(outputDirectory, { recursive: true });
const assets = [];

for (const pngName of pngNames) {
  const { stem, family, suffix } = assetParts(pngName);
  const names = englishNames(await readFile(path.join(sourceDirectory, `${stem}.txt`), 'utf8'));
  const origins = logicalOrigins(suffix, names.length);
  const ids = uniqueTerrainIds(names);
  const dimensions = dimensionsBySuffix[suffix];
  const id = `rpg-maker-mz-${slug(stem)}`;
  const image = `tilesets/rpg-maker-mz/${pngName}`;
  const configuration = `tilesets/rpg-maker-mz/${stem}.json`;
  const terrains = names.map((name, index) => ({
    id: ids[index],
    name,
    origin: { column: origins[index][0], row: origins[index][1] },
    ...(['A1', 'A2', 'A3', 'A4'].includes(suffix) ? { previewMask: 0 } : {}),
    ...(suffix === 'A1' ? { animation: index === 2 || index === 3 ? 'none' : index % 2 === 1 && index >= 5 ? 'vertical' : 'horizontal' } : {}),
    ...(suffix === 'A4' ? { autotile: index % 16 < 8 ? 'floor' : 'wall' } : {}),
    collision: { kind: 'none' },
  }));
  const definition = {
    id,
    name: `${familyName(family)} ${suffix}`,
    category: `RPG Maker MZ / ${familyName(family)}`,
    kind: suffix === 'A1' ? 'a1' : suffix === 'A2' ? 'a2' : suffix === 'A3' ? 'a3' : suffix === 'A4' ? 'a4' : suffix === 'A5' ? 'a5' : 'grid',
    image,
    tileSize: 48,
    ...(['A1', 'A2', 'A3', 'A4'].includes(suffix) ? { quarterSize: 24 } : {}),
    ...dimensions,
    terrains,
    ...(['A1', 'A2', 'A3', 'A4'].includes(suffix) ? { variants } : {}),
  };

  await copyFile(path.join(sourceDirectory, pngName), path.join(outputDirectory, pngName));
  await writeFile(path.join(outputDirectory, `${stem}.json`), `${JSON.stringify(definition, null, 2)}\n`);
  assets.push({ id, name: definition.name, type: 'tileset', tags: assetTags(family, suffix, names), image, configuration });
}

await writeFile(path.join(outputDirectory, 'library.json'), `${JSON.stringify({
  id: 'rpg-maker-mz',
  name: 'RPG Maker MZ',
  version: 1,
  assets,
}, null, 2)}\n`);

console.log(`Generated ${assets.length} RPG Maker MZ tilesets in ${outputDirectory}`);
