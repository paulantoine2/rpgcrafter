import type { AutotileVariant, TilesetDefinition } from '@rpgcrafter/game-schema';

export type TilesetImportFormat = 'a2' | 'grid';

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
  if (format === 'a2' && (width % 96 || height % 144)) throw new Error('An A2 tileset must use dimensions that are multiples of 96×144 px.');
  if (format === 'grid' && (width % 48 || height % 48)) throw new Error('A grid tileset must use dimensions that are multiples of 48 px.');
  const columns = width / 48, rows = height / 48;
  const origins: Array<{ column: number; row: number }> = [];
  if (format === 'a2') for (let row = 0; row < rows; row += 3) for (let column = 0; column < columns; column += 2) origins.push({ column, row });
  if (format === 'grid') for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) origins.push({ column, row });
  const terrains = origins.map((origin, index) => ({ id: `tile-${index + 1}`, name: `Tile ${index + 1}`, origin, collision: { kind: 'none' as const } }));
  const common = { id, name: name.trim(), category: category.trim(), image: `tilesets/${id}.png`, tileSize: 48, columns, rows };
  if (format === 'grid') return { ...common, kind: 'grid', terrains };
  if (!input.variants || !Object.keys(input.variants).length) throw new Error('A2 autotile recipes are unavailable.');
  return { ...common, kind: 'a2', quarterSize: 24, terrains: terrains.map(terrain => ({ ...terrain, previewMask: 0 })), variants: structuredClone(input.variants) };
}

export async function pngDimensions(file: Blob) {
  if (file.type && file.type !== 'image/png') throw new Error('Only PNG files are supported.');
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}
