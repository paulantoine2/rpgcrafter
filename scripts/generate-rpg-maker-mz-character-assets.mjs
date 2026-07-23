import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceDirectory = path.resolve(process.argv[2] || '');
const outputDirectory = path.resolve('assets/sprites/rpg-maker-mz');

if (!process.argv[2]) throw new Error('Usage: node scripts/generate-rpg-maker-mz-character-assets.mjs <RPG Maker MZ character directory>');

function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sprite';
}

function pngDimensions(bytes, fileName) {
  const pngSignature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== pngSignature) throw new Error(`${fileName} is not a valid PNG.`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function spriteMetadata(fileName, width, height) {
  const stem = fileName.replace(/\.png$/i, '');
  const singleCharacter = stem.includes('$');
  const objectAligned = stem.startsWith('!');
  const baseName = stem.replace(/^!\$?/, '').replace(/^\$/, '');
  const characterColumns = singleCharacter ? 1 : 4;
  const characterRows = singleCharacter ? 1 : 2;
  const sheetColumns = characterColumns * 3;
  const sheetRows = characterRows * 4;
  if (width % sheetColumns || height % sheetRows) throw new Error(`${fileName} does not match its RPG Maker MZ character layout.`);
  const scienceFiction = baseName.startsWith('SF_');
  const contentName = baseName.replace(/^SF_/, '').replaceAll('_', ' ');
  const tags = new Set(['rpg-maker-mz', 'animated', singleCharacter ? 'single-character' : 'character-sheet']);
  tags.add(scienceFiction ? 'sci-fi' : 'fantasy');
  if (objectAligned) tags.add('object');
  if (/actor|people|evil|nature/i.test(contentName)) tags.add('character');
  if (/monster/i.test(contentName)) tags.add('monster');
  if (/damage/i.test(contentName)) tags.add('damage');
  if (/vehicle/i.test(contentName)) tags.add('vehicle');
  if (/gate|door|chest|switch|crystal|flame|other|weapon/i.test(contentName)) tags.add('prop');
  return {
    id: `rpg-maker-mz-${slug(baseName)}`,
    name: `${scienceFiction ? 'Science Fiction ' : ''}${contentName}`,
    type: 'character-sprite',
    tags: [...tags],
    image: `sprites/rpg-maker-mz/${fileName}`,
    layout: {
      format: 'rpg-maker-mz-character',
      characterColumns,
      characterRows,
      characterCount: characterColumns * characterRows,
      patterns: 3,
      directions: ['down', 'left', 'right', 'up'],
      frameWidth: width / sheetColumns,
      frameHeight: height / sheetRows,
      objectAligned,
    },
  };
}

const pngNames = (await readdir(sourceDirectory)).filter(name => name.toLowerCase().endsWith('.png')).sort((a, b) => a.localeCompare(b));
if (!pngNames.length) throw new Error(`No PNG character sprites found in ${sourceDirectory}`);

await mkdir(outputDirectory, { recursive: true });
const assets = [];
for (const fileName of pngNames) {
  const sourcePath = path.join(sourceDirectory, fileName);
  const bytes = await readFile(sourcePath);
  const { width, height } = pngDimensions(bytes, fileName);
  assets.push(spriteMetadata(fileName, width, height));
  await copyFile(sourcePath, path.join(outputDirectory, fileName));
}

if (new Set(assets.map(asset => asset.id)).size !== assets.length) throw new Error('Generated sprite asset ids must be unique.');
await writeFile(path.join(outputDirectory, 'library.json'), `${JSON.stringify({
  id: 'rpg-maker-mz',
  name: 'RPG Maker MZ',
  version: 1,
  assets,
}, null, 2)}\n`);

console.log(`Generated ${assets.length} RPG Maker MZ character sprites in ${outputDirectory}`);
