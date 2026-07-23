import type { AutotileVariant, TilesetDefinition } from '@rpgcrafter/game-schema';

export type TilesetImportFormat = 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'grid';

export function tilesetConfigurationPath(image: string) {
  return image.replace(/\.png$/i, '.json');
}

export function tilesetConfigurationBlob(definition: TilesetDefinition) {
  return new Blob([`${JSON.stringify(definition, null, 2)}\n`], { type: 'application/json' });
}

export function slugifyAssetId(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tileset';
}

export function uniqueAssetId(name: string, existingIds: Iterable<string>) {
  const used = new Set(existingIds), base = slugifyAssetId(name);
  let id = base, suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

export function createTilesetDefinition(input: {
  id: string; name: string; category: string; format: TilesetImportFormat; width: number; height: number;
  variants?: Record<string, AutotileVariant>;
}): TilesetDefinition {
  const { id, name, category, format, width, height } = input;
  if (!name.trim() || !category.trim()) throw new Error('Name and category are required.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('The PNG dimensions are invalid.');
  if (format === 'a1' && (width !== 768 || height !== 576)) throw new Error('An RPG Maker MZ A1 tileset must be exactly 768×576 px.');
  if (format === 'a2' && (width % 96 || height % 144)) throw new Error('An A2 tileset must use dimensions that are multiples of 96×144 px.');
  if (format === 'a3' && (width !== 768 || height !== 384)) throw new Error('An RPG Maker MZ A3 tileset must be exactly 768×384 px.');
  if (format === 'a4' && (width !== 768 || height !== 720)) throw new Error('An RPG Maker MZ A4 tileset must be exactly 768×720 px.');
  if (format === 'a5' && (width !== 384 || height !== 768)) throw new Error('An RPG Maker MZ A5 tileset must be exactly 384×768 px.');
  if (format === 'grid' && (width % 48 || height % 48)) throw new Error('A grid tileset must use dimensions that are multiples of 48 px.');
  const columns = width / 48, rows = height / 48;
  const origins: Array<{ column: number; row: number }> = [];
  if (format === 'a1') origins.push(
    { column: 0, row: 0 }, { column: 0, row: 3 }, { column: 6, row: 0 }, { column: 6, row: 3 },
    { column: 8, row: 0 }, { column: 14, row: 0 }, { column: 8, row: 3 }, { column: 14, row: 3 },
    { column: 0, row: 6 }, { column: 6, row: 6 }, { column: 0, row: 9 }, { column: 6, row: 9 },
    { column: 8, row: 6 }, { column: 14, row: 6 }, { column: 8, row: 9 }, { column: 14, row: 9 },
  );
  if (format === 'a2') for (let row = 0; row < rows; row += 3) for (let column = 0; column < columns; column += 2) origins.push({ column, row });
  if (format === 'a3') for (let row = 0; row < rows; row += 2) for (let column = 0; column < columns; column += 2) origins.push({ column, row });
  if (format === 'a4') for (let groupRow = 0; groupRow < rows; groupRow += 5) {
    for (let column = 0; column < columns; column += 2) origins.push({ column, row: groupRow });
    for (let column = 0; column < columns; column += 2) origins.push({ column, row: groupRow + 3 });
  }
  if (format === 'grid' || format === 'a5') for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) origins.push({ column, row });
  const terrains = origins.map((origin, index) => ({ id: `tile-${index + 1}`, name: `Tile ${index + 1}`, origin, collision: { kind: 'none' as const } }));
  const common = { id, name: name.trim(), category: category.trim(), image: `tilesets/${id}.png`, tileSize: 48, columns, rows };
  if (format === 'grid') return { ...common, kind: 'grid', terrains };
  if (format === 'a5') return { ...common, kind: 'a5', terrains };
  if (!input.variants || !Object.keys(input.variants).length) throw new Error(`${format.toUpperCase()} autotile recipes are unavailable.`);
  if (format === 'a1') return {
    ...common, kind: 'a1', quarterSize: 24,
    terrains: terrains.map((terrain, index) => ({ ...terrain, previewMask: 0, animation: index === 2 || index === 3 ? 'none' as const : index % 2 === 1 && index >= 5 ? 'vertical' as const : 'horizontal' as const })),
    variants: structuredClone(input.variants),
  };
  if (format === 'a4') return {
    ...common, kind: 'a4', quarterSize: 24,
    terrains: terrains.map((terrain, index) => ({ ...terrain, previewMask: 0, autotile: index % 16 < 8 ? 'floor' as const : 'wall' as const })),
    variants: structuredClone(input.variants),
  };
  if (format === 'a3') return {
    ...common, kind: 'a3', quarterSize: 24,
    terrains: terrains.map(terrain => ({ ...terrain, previewMask: 0 })),
    variants: structuredClone(input.variants),
  };
  return { ...common, kind: 'a2', quarterSize: 24, terrains: terrains.map(terrain => ({ ...terrain, previewMask: 0 })), variants: structuredClone(input.variants) };
}

export async function pngDimensions(file: Blob) {
  if (file.type && file.type !== 'image/png') throw new Error('Only PNG files are supported.');
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}
