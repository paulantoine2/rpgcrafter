import { autotileVariant, type TilesetDefinition } from '@rpgcrafter/game-schema';

export function TerrainPreview({ tileset, terrainId, imageUrl }: { tileset: TilesetDefinition; terrainId: string; imageUrl: string }) {
  const terrain = tileset.terrains.find(item => item.id === terrainId)!;
  if (tileset.kind === 'grid' || tileset.kind === 'a5') return <span className="block size-12 bg-no-repeat [image-rendering:pixelated]" data-preview-kind={tileset.kind} style={{ backgroundImage: `url(${imageUrl})`, backgroundPosition: `${-terrain.origin.column * 48}px ${-terrain.origin.row * 48}px`, backgroundSize: `${tileset.columns * 48}px ${tileset.rows * 48}px` }} />;
  const previewMask = 0;
  const animation = tileset.kind === 'a1' && 'animation' in terrain ? terrain.animation : 'none';
  const recipe = animation === 'vertical' ? 'waterfall' : tileset.kind === 'a3' || tileset.kind === 'a4' && 'autotile' in terrain && terrain.autotile === 'wall' ? 'wall' : 'floor';
  const variant = autotileVariant(tileset, previewMask, recipe);
  return <span className="grid size-12 grid-cols-2 overflow-hidden bg-muted [image-rendering:pixelated]" data-preview-kind={tileset.kind} data-preview-mask={previewMask}>
    {variant.quarters.map(([quarterX, quarterY], index) => <span key={index} className="size-6 bg-no-repeat" style={{
      backgroundImage: `url(${imageUrl})`,
      backgroundPosition: `${-(terrain.origin.column * tileset.tileSize + quarterX * tileset.quarterSize)}px ${-(terrain.origin.row * tileset.tileSize + quarterY * tileset.quarterSize)}px`,
      backgroundSize: `${tileset.columns * tileset.tileSize}px ${tileset.rows * tileset.tileSize}px`,
    }} />)}
  </span>;
}
