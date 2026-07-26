import { useState } from 'react';
import type { MapEventSprite } from '@rpgcrafter/game-schema';
import { Search } from 'lucide-react';
import type { LibrarySprite } from '@/components/asset-manager-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function spriteReference(asset: LibrarySprite, characterIndex: number): MapEventSprite {
  return {
    image: asset.imagePath,
    characterIndex,
    characterColumns: asset.layout.characterColumns,
    frameWidth: asset.layout.frameWidth,
    frameHeight: asset.layout.frameHeight,
    objectAligned: asset.layout.objectAligned,
  };
}

export function SpritePreview({ sprite, imageUrl, characterRows = 2, className }: { sprite: MapEventSprite; imageUrl?: string; characterRows?: number; className?: string }) {
  const characterColumn = sprite.characterIndex % sprite.characterColumns;
  const characterRow = Math.floor(sprite.characterIndex / sprite.characterColumns);
  const sourceColumns = sprite.characterColumns * 3;
  const sourceRows = Math.max(characterRows, characterRow + 1) * 4;
  const frameColumn = characterColumn * 3 + 1;
  const frameRow = characterRow * 4;
  const maxDimension = Math.max(sprite.frameWidth, sprite.frameHeight);
  return <span className={cn('grid place-items-center overflow-hidden bg-muted/30', className)}>
    {imageUrl
      ? <span
          aria-hidden="true"
          className="[image-rendering:pixelated]"
          style={{
            width: `${sprite.frameWidth / maxDimension * 100}%`,
            height: `${sprite.frameHeight / maxDimension * 100}%`,
            backgroundImage: `url("${imageUrl}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${sourceColumns * 100}% ${sourceRows * 100}%`,
            backgroundPosition: `${sourceColumns > 1 ? frameColumn / (sourceColumns - 1) * 100 : 0}% ${sourceRows > 1 ? frameRow / (sourceRows - 1) * 100 : 0}%`,
          }}
        />
      : <span className="text-xs text-muted-foreground">None</span>}
  </span>;
}

export function EventSpritePicker({ open, onOpenChange, sprites, selected, onSelect }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprites: LibrarySprite[];
  selected?: MapEventSprite;
  onSelect: (asset: LibrarySprite, characterIndex: number) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSprites = sprites.filter(asset => !normalizedQuery || [asset.name, asset.bundleName || '', ...asset.tags].some(value => value.toLocaleLowerCase().includes(normalizedQuery)));
  const choose = async (asset: LibrarySprite, characterIndex: number) => {
    await onSelect(asset, characterIndex);
    onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[82vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader className="border-b px-5 py-4"><DialogTitle>Choose an event sprite</DialogTitle><DialogDescription>Browse the sprite library and select a character or object.</DialogDescription></DialogHeader>
      <div className="relative border-b p-4"><Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label="Search event sprites" className="pl-9" placeholder="Search by name, bundle, or tag…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {visibleSprites.flatMap(asset => Array.from({ length: asset.layout.characterCount }, (_, characterIndex) => {
            const reference = spriteReference(asset, characterIndex);
            const active = selected?.image === reference.image && selected.characterIndex === characterIndex;
            return <Button key={`${asset.id}:${characterIndex}`} type="button" variant="outline" className={cn('h-auto min-w-0 flex-col gap-2 p-2', active && 'border-primary ring-2 ring-primary/30')} aria-label={`Choose ${asset.name}${asset.layout.characterCount > 1 ? ` ${characterIndex + 1}` : ''}`} onClick={() => void choose(asset, characterIndex)}>
              <SpritePreview sprite={reference} imageUrl={asset.url} characterRows={asset.layout.characterRows} className="size-20 border" />
              <span className="w-full truncate text-xs">{asset.name}{asset.layout.characterCount > 1 ? ` · ${characterIndex + 1}` : ''}</span>
            </Button>;
          }))}
        </div>
        {!visibleSprites.length && <p className="py-12 text-center text-sm text-muted-foreground">No sprites match “{query}”.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
