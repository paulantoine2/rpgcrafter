import { useEffect, useState, type RefObject } from 'react';
import type { MapEventSprite } from '@rpgcrafter/game-schema';
import { Popover } from '@base-ui/react/popover';
import { Search, X } from 'lucide-react';
import type { LibrarySprite } from '@/components/asset-manager-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import { PopoverPanel, SectionHeader, SectionHeaderActions } from '@/components/sidebar-section';
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

function spritePickerAnchor(trigger: HTMLElement | null) {
  const panel = document.querySelector<HTMLElement>('[data-event-inspector-panel]');
  if (!trigger || !panel) return trigger;
  return {
    contextElement: panel,
    getBoundingClientRect: () => {
      const panelRect = panel.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      return {
        x: panelRect.left,
        y: triggerRect.top,
        top: triggerRect.top,
        right: panelRect.left,
        bottom: triggerRect.bottom,
        left: panelRect.left,
        width: 0,
        height: triggerRect.height,
      };
    },
  };
}

export function EventSpritePicker({ open, onOpenChange, anchor, sprites, selected, onSelect }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  sprites: LibrarySprite[];
  selected?: MapEventSprite;
  onSelect: (asset: LibrarySprite, characterIndex: number) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSprites = sprites.filter(asset => !normalizedQuery || [asset.name, asset.bundleName || '', ...asset.tags].some(value => value.toLocaleLowerCase().includes(normalizedQuery)));
  const choose = async (asset: LibrarySprite, characterIndex: number) => {
    await onSelect(asset, characterIndex);
    onOpenChange(false);
  };

  return <Popover.Portal>
    <Popover.Positioner anchor={() => spritePickerAnchor(anchor.current)} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
      <PopoverPanel className="w-72">
        <SectionHeader className="border-t-0 border-b">
          <span className="min-w-0 flex-1">Sprites</span>
          <SectionHeaderActions><IconButtonTooltip label="Close sprite picker"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close sprite picker" onClick={() => onOpenChange(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
        </SectionHeader>
        <div className="flex h-9 items-center gap-2 border-b px-3">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Input autoFocus type="search" aria-label="Search event sprites" className="h-7 border-0 bg-transparent px-0 focus-visible:ring-0 dark:bg-transparent" placeholder="Search sprites…" value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <ScrollArea className="h-80 min-h-0">
          <div className="p-1" role="listbox" aria-label="Event sprites">
            {visibleSprites.flatMap(asset => Array.from({ length: asset.layout.characterCount }, (_, characterIndex) => {
              const reference = spriteReference(asset, characterIndex);
              const active = selected?.image === reference.image && selected.characterIndex === characterIndex;
              const label = `${asset.name}${asset.layout.characterCount > 1 ? ` ${characterIndex + 1}` : ''}`;
              return <button key={`${asset.id}:${characterIndex}`} type="button" role="option" aria-selected={active} className={cn('flex h-12 w-full items-center gap-2 px-2 text-left text-xs hover:bg-muted', active && 'bg-primary/15')} aria-label={label} onClick={() => void choose(asset, characterIndex)}>
                <SpritePreview sprite={reference} imageUrl={asset.url} characterRows={asset.layout.characterRows} className="size-9 shrink-0 rounded-md border" />
                <span className="min-w-0 flex-1 truncate">{asset.name}{asset.layout.characterCount > 1 ? ` · ${characterIndex + 1}` : ''}</span>
              </button>;
            }))}
            {!visibleSprites.length && <p className="px-3 py-8 text-center text-xs text-muted-foreground">No sprites match “{query}”.</p>}
          </div>
        </ScrollArea>
      </PopoverPanel>
    </Popover.Positioner>
  </Popover.Portal>;
}
