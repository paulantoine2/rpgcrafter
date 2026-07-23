import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'assets/tilesets/rpg-maker-mz');
const files = (await readdir(directory)).filter(file => /_(A[1-5]|B|C)\.json$/i.test(file)).sort();
const definitions = await Promise.all(files.map(async file => [file, JSON.parse(await readFile(path.join(directory, file), 'utf8'))]));
const variants = definitions.map(([, definition]) => definition).find(definition => definition.kind === 'a2')?.variants;
if (!variants) throw new Error('An A2 configuration is required as the autotile recipe source.');

for (const [file, definition] of definitions) {
  const suffix = /_(A[1-5]|B|C)\.json$/i.exec(file)?.[1].toUpperCase();
  const terrains = definition.terrains.map((terrain, index) => {
    if (suffix === 'A1') {
      const origins = [
        [0, 0], [0, 3], [6, 0], [6, 3], [8, 0], [14, 0], [8, 3], [14, 3],
        [0, 6], [6, 6], [0, 9], [6, 9], [8, 6], [14, 6], [8, 9], [14, 9],
      ];
      if (definition.terrains.length !== origins.length) throw new Error(`${file} must expose 16 A1 terrains.`);
      return { ...terrain, origin: { column: origins[index][0], row: origins[index][1] }, previewMask: 0, animation: index === 2 || index === 3 ? 'none' : index % 2 === 1 && index >= 5 ? 'vertical' : 'horizontal' };
    }
    if (suffix === 'A2') return { ...terrain, origin: { column: (index % 8) * 2, row: Math.floor(index / 8) * 3 }, previewMask: 0 };
    if (suffix === 'A3') return { ...terrain, origin: { column: (index % 8) * 2, row: Math.floor(index / 8) * 2 }, previewMask: 0 };
    if (suffix === 'A4') {
      const group = Math.floor(index / 16), withinGroup = index % 16, wall = withinGroup >= 8;
      return { ...terrain, origin: { column: (withinGroup % 8) * 2, row: group * 5 + (wall ? 3 : 0) }, previewMask: 0, autotile: wall ? 'wall' : 'floor' };
    }
    const columns = suffix === 'A5' ? 8 : 16;
    return { ...terrain, origin: { column: index % columns, row: Math.floor(index / columns) } };
  });
  const autotile = ['A1', 'A2', 'A3', 'A4'].includes(suffix);
  const normalized = {
    ...definition,
    kind: suffix === 'A1' ? 'a1' : suffix === 'A2' ? 'a2' : suffix === 'A3' ? 'a3' : suffix === 'A4' ? 'a4' : suffix === 'A5' ? 'a5' : 'grid',
    ...(autotile ? { quarterSize: 24 } : {}),
    terrains,
    ...(autotile ? { variants } : {}),
  };
  await writeFile(path.join(directory, file), `${JSON.stringify(normalized, null, 2)}\n`);
}

console.log(`Normalized ${definitions.length} RPG Maker MZ tileset configurations.`);
