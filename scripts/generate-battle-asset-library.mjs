import { readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = new URL('../assets/battle/rpg-maker-mz/', import.meta.url);
const definitions = [
  { directory: 'sv_actors', type: 'actor-battler', tags: ['battle', 'actor', 'side-view', 'animated'] },
  { directory: 'enemies', type: 'enemy-battler', tags: ['battle', 'enemy', 'front-view'] },
  { directory: 'sv_enemies', type: 'side-view-enemy-battler', tags: ['battle', 'enemy', 'side-view'] },
  { directory: 'battlebacks1', type: 'battle-background-lower', tags: ['battle', 'background', 'lower-layer'] },
  { directory: 'battlebacks2', type: 'battle-background-upper', tags: ['battle', 'background', 'upper-layer'] },
];

const idPart = value => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const usedIds = new Map();
const uniqueId = base => {
  const occurrence = (usedIds.get(base) || 0) + 1;
  usedIds.set(base, occurrence);
  return occurrence === 1 ? base : `${base}-${occurrence}`;
};

const assets = definitions.flatMap(definition => readdirSync(new URL(`${definition.directory}/`, root))
  .filter(file => file.toLowerCase().endsWith('.png'))
  .sort((left, right) => left.localeCompare(right))
  .map(file => ({
    id: uniqueId(`rpg-maker-mz-${idPart(definition.directory)}-${idPart(basename(file, '.png'))}`),
    name: basename(file, '.png').replaceAll('_', ' '),
    type: definition.type,
    tags: ['rpg-maker-mz', ...definition.tags],
    image: `battle/rpg-maker-mz/${definition.directory}/${file}`,
    ...(definition.type === 'actor-battler' ? {
      layout: {
        format: 'rpg-maker-mz-side-view-actor',
        columns: 9,
        rows: 6,
        frameWidth: 64,
        frameHeight: 64,
        idleFrame: { column: 3, row: 0 },
      },
    } : {}),
  })));

const library = {
  id: 'rpg-maker-mz',
  name: 'RPG Maker MZ',
  version: 1,
  assets,
};

writeFileSync(join(root.pathname, 'library.json'), `${JSON.stringify(library, null, 2)}\n`);
