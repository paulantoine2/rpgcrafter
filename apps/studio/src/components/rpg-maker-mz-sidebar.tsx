import type { GameMap, SourceGame, TileLayer } from '@rpgcrafter/game-schema';
import { MapList } from '@/components/map-list';
import { TilePalette, type SelectedTerrain } from '@/components/studio-sidebar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import type { MapDropPosition } from '@/lib/map-hierarchy';

export function RpgMakerMzSidebar({ game, assetUrls, selectedMapId, activeLayer, selectedTerrain, onSelectTerrain, onSelectMap, onCreateMap, onRenameMap, onMoveMap, onReorderMap, onResizeMap, onChangeMapEncounters }: {
  game: SourceGame;
  assetUrls: Record<string, string>;
  selectedMapId: number;
  activeLayer: TileLayer | null;
  selectedTerrain: SelectedTerrain | null;
  onSelectTerrain: (terrain: SelectedTerrain) => void;
  onSelectMap: (id: number) => void;
  onCreateMap: (width: number, height: number) => void;
  onRenameMap: (id: number, name: string) => void;
  onMoveMap: (id: number, parentMapId: number | null) => void;
  onReorderMap: (id: number, targetId: number, position: MapDropPosition) => void;
  onResizeMap: (id: number, width: number, height: number) => void;
  onChangeMapEncounters: (id: number, encounters: NonNullable<GameMap['encounters']>) => void;
}) {
  return <aside className="flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground" aria-label="RPG Maker MZ map tools">
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize="60%" minSize="180px" className="flex min-h-0 flex-col">
        <div className="flex h-7 shrink-0 items-center border-b px-2 text-xs font-semibold">Tiles</div>
        <TilePalette game={game} assetUrls={assetUrls} activeLayer={activeLayer} selectedTerrain={selectedTerrain} onSelect={onSelectTerrain} />
      </ResizablePanel>
      <ResizableHandle />
      <MapList game={game} selectedMapId={selectedMapId} onSelect={onSelectMap} onCreate={onCreateMap} onRename={onRenameMap} onMove={onMoveMap} onReorder={onReorderMap} onResize={onResizeMap} onChangeEncounters={onChangeMapEncounters} />
    </ResizablePanelGroup>
  </aside>;
}
