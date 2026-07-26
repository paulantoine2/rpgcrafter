import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Direction, SourceGame, TerrainCollision, TilesetDefinition } from '@rpgcrafter/game-schema';
import { Boxes, FolderOpen, ImagePlus, Library, Minus, Pencil, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLLISION_DIRECTIONS, nearestCollisionEdge, toggleA2BoundaryCollision, toggleCellCollision, toggleEdgeCollision } from '@/lib/terrain-collision';
import type { TilesetImportFormat } from '@/lib/tileset-import';

export type LibraryTileset = { kind: 'tileset'; definition: TilesetDefinition; blob: Blob; configurationPath: string; configurationBlob: Blob; url: string; assetType: string; bundleId?: string; bundleName?: string; tags: string[] };
export type LibrarySprite = { kind: 'sprite'; id: string; name: string; blob: Blob; imagePath: string; url: string; assetType: string; bundleId?: string; bundleName?: string; tags: string[]; layout: { characterColumns: number; characterRows: number; characterCount: number; patterns: number; directions: string[]; frameWidth: number; frameHeight: number; objectAligned: boolean } };
export type LibraryAsset = LibraryTileset | LibrarySprite;
export type LibraryBundle = { id: string; name: string; version: number; assets: LibraryAsset[] };
type ObstacleTool = 'cell' | 'edge';
type HoverTarget = { terrainId: string; edge?: Direction; boundary?: boolean };

function targetFromPointer(event: PointerEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>, tool: ObstacleTool, tilesetKind: TilesetDefinition['kind']): HoverTarget {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0.5;
  const y = bounds.height ? (event.clientY - bounds.top) / bounds.height : 0.5;
  return {
    terrainId: event.currentTarget.dataset.terrainId!,
    edge: tool === 'edge' && (tilesetKind === 'grid' || tilesetKind === 'a5') ? nearestCollisionEdge(x, y) : undefined,
    boundary: tool === 'edge' && tilesetKind !== 'grid' && tilesetKind !== 'a5' ? true : undefined,
  };
}

function EdgeOverlay({ edge, color, width = 3 }: { edge: Direction; color: string; width?: number }) {
  const style = { backgroundColor: color };
  if (edge === 'north') return <span aria-hidden="true" data-obstacle-edge={edge} className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ ...style, height: width }} />;
  if (edge === 'east') return <span aria-hidden="true" data-obstacle-edge={edge} className="pointer-events-none absolute inset-y-0 right-0 z-20" style={{ ...style, width }} />;
  if (edge === 'south') return <span aria-hidden="true" data-obstacle-edge={edge} className="pointer-events-none absolute inset-x-0 bottom-0 z-20" style={{ ...style, height: width }} />;
  return <span aria-hidden="true" data-obstacle-edge={edge} className="pointer-events-none absolute inset-y-0 left-0 z-20" style={{ ...style, width }} />;
}

function TilesetCanvas({ tileset, imageUrl, tool, onChange }: {
  tileset: TilesetDefinition;
  imageUrl: string;
  tool: ObstacleTool;
  onChange: (terrainId: string, collision: TerrainCollision) => void;
}) {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const toggle = (terrainId: string, edge?: Direction) => {
    const terrain = tileset.terrains.find(item => item.id === terrainId);
    if (!terrain) return;
    const collision = tool === 'cell'
      ? toggleCellCollision(terrain.collision)
      : tileset.kind !== 'grid' && tileset.kind !== 'a5'
        ? toggleA2BoundaryCollision(terrain.collision)
        : toggleEdgeCollision(terrain.collision, edge!);
    onChange(terrain.id, collision);
  };
  const width = tileset.columns * tileset.tileSize;
  const height = tileset.rows * tileset.tileSize;

  return <div
    className="relative shrink-0 overflow-hidden bg-background shadow-[0_0_0_1px_var(--border)]"
    style={{ width, height }}
    role="grid"
    aria-label={`${tileset.name} obstacle grid`}
    data-tileset-canvas
  >
    <img src={imageUrl} alt={`${tileset.name} source`} className="absolute inset-0 size-full max-w-none [image-rendering:pixelated]" data-tileset-source />
    {tileset.terrains.map(terrain => {
      const gridLike = tileset.kind === 'grid' || tileset.kind === 'a5';
      const regionWidth = tileset.kind === 'a1' ? tileset.tileSize * ('animation' in terrain && terrain.animation === 'horizontal' ? 6 : 2) : !gridLike ? tileset.tileSize * 2 : tileset.tileSize;
      const regionHeight = gridLike ? tileset.tileSize : tileset.kind === 'a3' || tileset.kind === 'a4' && 'autotile' in terrain && terrain.autotile === 'wall' ? tileset.tileSize * 2 : tileset.tileSize * 3;
      const hovered = hover?.terrainId === terrain.id ? hover : null;
      const edges = terrain.collision.kind === 'edges' && terrain.collision.edges.length
        ? !gridLike ? COLLISION_DIRECTIONS : terrain.collision.edges
        : [];
      return <button
        key={terrain.id}
        type="button"
        role="gridcell"
        title={terrain.name}
        data-terrain-id={terrain.id}
        data-collision-kind={terrain.collision.kind}
        aria-label={`${terrain.name} obstacle: ${terrain.collision.kind}`}
        className="absolute overflow-hidden outline-none hover:bg-cyan-300/10 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-cyan-300"
        style={{ left: terrain.origin.column * tileset.tileSize, top: terrain.origin.row * tileset.tileSize, width: regionWidth, height: regionHeight }}
        onPointerMove={event => setHover(targetFromPointer(event, tool, tileset.kind))}
        onPointerLeave={() => setHover(null)}
        onClick={event => { const target = targetFromPointer(event, tool, tileset.kind); toggle(target.terrainId, target.edge); }}
      >
        {terrain.collision.kind === 'blockCell' && <span aria-hidden="true" data-obstacle-cell className="pointer-events-none absolute inset-0 z-10 bg-red-500/35" />}
        {edges.map(edge => <EdgeOverlay key={edge} edge={edge} color="#f59e0b" width={4} />)}
        {hovered && !hovered.edge && !hovered.boundary && <span aria-hidden="true" data-obstacle-hover="cell" className="pointer-events-none absolute inset-0 z-20 bg-cyan-300/20 shadow-[inset_0_0_0_2px_#67e8f9]" />}
        {hovered?.edge && <EdgeOverlay edge={hovered.edge} color="#67e8f9" width={7} />}
        {hovered?.boundary && COLLISION_DIRECTIONS.map(edge => <EdgeOverlay key={edge} edge={edge} color="#67e8f9" width={7} />)}
      </button>;
    })}
  </div>;
}

function LibraryDialog({ open, onOpenChange, game, assetUrls, library, sprites, bundles, onImport, onImportSprite, onImportBundle }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: SourceGame;
  assetUrls: Record<string, string>;
  library: LibraryTileset[];
  sprites: LibrarySprite[];
  bundles: LibraryBundle[];
  onImport: (asset: LibraryTileset) => Promise<void>;
  onImportSprite: (asset: LibrarySprite) => Promise<void>;
  onImportBundle: (bundle: LibraryBundle) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (name: string, assetType: string, bundleName: string | undefined, tags: string[]) => !normalizedQuery || [name, assetType, bundleName || '', ...tags].some(value => value.toLocaleLowerCase().includes(normalizedQuery));
  const visibleAssets = library.filter(asset => matchesQuery(asset.definition.name, asset.assetType, asset.bundleName, asset.tags));
  const visibleSprites = sprites.filter(asset => matchesQuery(asset.name, asset.assetType, asset.bundleName, asset.tags));
  const assetTypeLabel = (value: string) => value.replaceAll('-', ' ').replace(/^./, letter => letter.toUpperCase());
  const assetId = (asset: LibraryAsset) => asset.kind === 'tileset' ? asset.definition.id : asset.id;
  const imported = (asset: LibraryAsset) => asset.kind === 'tileset' ? Boolean(game.tilesets[asset.definition.id]) : Boolean(assetUrls[asset.imagePath]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[82vh] max-w-3xl grid-rows-[auto_1fr_auto] overflow-hidden p-0 sm:max-w-3xl">
    <DialogHeader className="border-b px-5 py-4"><DialogTitle>Assets Library</DialogTitle><DialogDescription>Import individual assets or complete bundles into this project.</DialogDescription></DialogHeader>
    <Tabs defaultValue="tilesets" className="grid min-h-0 grid-rows-[auto_1fr] gap-0">
      <TabsList aria-label="Library content" className="h-auto w-full justify-start gap-1 border-b bg-transparent px-5 pt-2">
        <TabsTrigger value="tilesets"><ImagePlus />Tilesets</TabsTrigger>
        <TabsTrigger value="sprites"><ImagePlus />Sprites</TabsTrigger>
        <TabsTrigger value="bundles"><Boxes />Bundles</TabsTrigger>
      </TabsList>
      <TabsContent value="tilesets" aria-label="Tilesets" className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><Input type="search" aria-label="Search assets" placeholder="Search by name, type, bundle, or tag…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {visibleAssets.map(asset => {
      const isImported = imported(asset);
      return <article key={asset.definition.id} className="flex gap-3 border bg-muted/10 p-3">
        <img src={asset.url} alt="" className="size-28 shrink-0 border bg-background object-cover [image-rendering:pixelated]" />
        <div className="min-w-0 flex-1"><div className="truncate font-medium">{asset.definition.name}</div><div className="mt-1"><Badge variant="secondary">{assetTypeLabel(asset.assetType)}</Badge></div>{asset.bundleName && <div className="mt-1 truncate text-xs text-muted-foreground">Bundle · {asset.bundleName}</div>}<div className="mt-2 flex flex-wrap gap-1">{asset.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}</div><Button className="mt-3" size="sm" disabled={isImported} onClick={() => void onImport(asset)}>{isImported ? 'Imported' : 'Import'}</Button></div>
      </article>;
    })}{!visibleAssets.length && <p className="sm:col-span-2 py-8 text-center text-sm text-muted-foreground">No assets match “{query}”.</p>}</TabsContent>
      <TabsContent value="sprites" aria-label="Sprites" className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><Input type="search" aria-label="Search sprites" placeholder="Search sprites by name, bundle, or tag…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {visibleSprites.map(asset => {
        const isImported = imported(asset);
        return <article key={asset.id} className="flex gap-3 border bg-muted/10 p-3">
          <img src={asset.url} alt="" className="size-28 shrink-0 border bg-background object-contain [image-rendering:pixelated]" />
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{asset.name}</div><div className="mt-1"><Badge variant="secondary">{assetTypeLabel(asset.assetType)}</Badge></div>{asset.bundleName && <div className="mt-1 truncate text-xs text-muted-foreground">Bundle · {asset.bundleName}</div>}<div className="mt-1 text-xs text-muted-foreground">{asset.layout.characterCount} character{asset.layout.characterCount === 1 ? '' : 's'} · {asset.layout.frameWidth}×{asset.layout.frameHeight}px frames</div><div className="mt-2 flex flex-wrap gap-1">{asset.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}</div><Button className="mt-3" size="sm" disabled={isImported} onClick={() => void onImportSprite(asset)}>{isImported ? 'Imported' : 'Import'}</Button></div>
        </article>;
      })}{!visibleSprites.length && <p className="sm:col-span-2 py-8 text-center text-sm text-muted-foreground">No sprites match “{query}”.</p>}</TabsContent>
      <TabsContent value="bundles" aria-label="Bundles" className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">{bundles.map(bundle => {
      const importedCount = bundle.assets.filter(imported).length;
      const remaining = bundle.assets.length - importedCount;
      return <article key={bundle.id} className="flex flex-col border bg-muted/10 p-4">
        <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center bg-primary/10 text-primary"><Boxes className="size-5" /></div><div className="min-w-0"><div className="font-medium">{bundle.name}</div><div className="mt-1 text-xs text-muted-foreground">{bundle.assets.length} assets · Version {bundle.version}</div></div></div>
        <div className="mt-4 flex -space-x-3">{bundle.assets.slice(0, 5).map(asset => <img key={assetId(asset)} src={asset.url} alt="" className="size-12 border-2 border-background bg-background object-cover [image-rendering:pixelated]" />)}</div>
        <div className="mt-4 text-xs text-muted-foreground">{importedCount} of {bundle.assets.length} imported</div>
        <Button className="mt-3 self-start" size="sm" disabled={!remaining} onClick={() => void onImportBundle(bundle)}>{remaining ? `Import bundle (${remaining})` : 'Imported'}</Button>
      </article>;
    })}</TabsContent>
    </Tabs>
    <DialogFooter className="border-t px-5 py-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function ImportDialog({ open, onOpenChange, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (input: { file: File; name: string; category: string; format: TilesetImportFormat }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null), [name, setName] = useState(''), [category, setCategory] = useState('Sol');
  const [format, setFormat] = useState<TilesetImportFormat>('grid'), [error, setError] = useState(''), [importing, setImporting] = useState(false);
  useEffect(() => { if (!open) { setFile(null); setName(''); setError(''); setImporting(false); } }, [open]);
  const importLocal = async () => {
    if (!file || !name.trim() || !category.trim()) return;
    setImporting(true); setError('');
    try { await onImport({ file, name: name.trim(), category: category.trim(), format }); onOpenChange(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The tileset could not be imported.'); }
    finally { setImporting(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl sm:max-w-xl">
    <DialogHeader><DialogTitle>Import a local PNG</DialogTitle><DialogDescription>Add a PNG as a grid or RPG Maker A1–A5 tileset.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label htmlFor="tileset-file">PNG file</Label><Input id="tileset-file" type="file" accept="image/png" onChange={event => { const next = event.target.files?.[0] || null; setFile(next); if (next && !name) setName(next.name.replace(/\.png$/i, '')); }} /></div>
      <div><Label htmlFor="tileset-name">Name</Label><Input id="tileset-name" value={name} onChange={event => setName(event.target.value)} /></div>
      <div><Label htmlFor="tileset-category">Category</Label><Input id="tileset-category" list="asset-categories" value={category} onChange={event => setCategory(event.target.value)} /></div>
      <div className="sm:col-span-2"><Label htmlFor="tileset-format">Format</Label><select id="tileset-format" className="flex h-9 w-full border bg-background px-3 text-sm" value={format} onChange={event => setFormat(event.target.value as TilesetImportFormat)}><option value="grid">Grid (48×48)</option><option value="a1">A1 animated autotile</option><option value="a2">A2 ground autotile</option><option value="a3">A3 roof/wall autotile</option><option value="a4">A4 wall autotile</option><option value="a5">A5 regular tiles</option></select></div>
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void importLocal()} disabled={!file || !name.trim() || !category.trim() || importing}>{importing ? 'Importing…' : 'Import PNG'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function AssetManagerDialog({ open, onOpenChange, game, assetUrls, library, sprites, bundles, onImportLibrary, onImportSprite, onImportLibraryBundle, onImportLocal, onUpdate, onChangeTerrainCollision }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: SourceGame;
  assetUrls: Record<string, string>;
  library: LibraryTileset[];
  sprites: LibrarySprite[];
  bundles: LibraryBundle[];
  onImportLibrary: (asset: LibraryTileset) => Promise<void>;
  onImportSprite: (asset: LibrarySprite) => Promise<void>;
  onImportLibraryBundle: (bundle: LibraryBundle) => Promise<void>;
  onImportLocal: (input: { file: File; name: string; category: string; format: TilesetImportFormat }) => Promise<void>;
  onUpdate: (id: string, values: { name: string; category: string }) => void;
  onChangeTerrainCollision: (tilesetId: string, terrainId: string, collision: TerrainCollision) => void;
}) {
  const projectTilesets = Object.values(game.tilesets);
  const categories = [...new Set(projectTilesets.map(tileset => tileset.category))].sort((a, b) => a.localeCompare(b));
  const [selectedId, setSelectedId] = useState(projectTilesets[0]?.id || '');
  const [tool, setTool] = useState<ObstacleTool>('cell');
  const [libraryOpen, setLibraryOpen] = useState(false), [importOpen, setImportOpen] = useState(false), [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(''), [editCategory, setEditCategory] = useState('');
  const selected = game.tilesets[selectedId] || projectTilesets[0];

  useEffect(() => {
    if (!open) { setLibraryOpen(false); setImportOpen(false); setEditOpen(false); return; }
    if (!game.tilesets[selectedId]) setSelectedId(Object.keys(game.tilesets)[0] || '');
  }, [open, game.tilesets, selectedId]);

  const openMetadata = () => {
    if (!selected) return;
    setEditName(selected.name);
    setEditCategory(selected.category);
    setEditOpen(true);
  };
  const saveMetadata = () => {
    if (!selected || !editName.trim() || !editCategory.trim()) return;
    onUpdate(selected.id, { name: editName.trim(), category: editCategory.trim() });
    setEditOpen(false);
  };

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="h-[92vh] w-[94vw] max-w-none grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-none">
      <DialogHeader className="border-b px-5 py-4"><DialogTitle className="text-base">Asset Manager</DialogTitle><DialogDescription>Manage project assets, inspect tileset pixels, and edit their default collisions.</DialogDescription></DialogHeader>
      <div className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r bg-muted/10">
          <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project tilesets</h3><ImagePlus className="size-4 text-primary" /></div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Project tilesets">{projectTilesets.map(tileset => <li key={tileset.id}><button
            type="button"
            aria-current={selected?.id === tileset.id ? 'true' : undefined}
            onClick={() => setSelectedId(tileset.id)}
            className="mb-1 flex w-full items-center gap-3 border border-transparent p-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring aria-current:border-border aria-current:bg-background aria-current:shadow-sm"
          >
            <img src={assetUrls[tileset.image]} alt="" className="size-12 shrink-0 border bg-background object-cover [image-rendering:pixelated]" />
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{tileset.name}</span><span className="block truncate text-[10px] text-muted-foreground">{tileset.category} · {tileset.kind.toUpperCase()}</span></span>
          </button></li>)}</ul>
          <div className="grid gap-2 border-t p-3"><Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}><Library />Open Assets Library</Button><Button size="sm" onClick={() => setImportOpen(true)}><Upload />Import PNG</Button></div>
        </aside>

        {selected ? <section className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
            <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{selected.name}</h2><p className="text-[10px] text-muted-foreground">{selected.category} · {selected.kind.toUpperCase()} · {selected.id}</p></div>
            <Button className="ml-auto" variant="outline" size="sm" onClick={openMetadata}><Pencil />Rename &amp; categorize</Button>
          </div>
          <div className="flex shrink-0 items-center gap-1 border-b bg-background/80 px-5 py-2" role="toolbar" aria-label="Tileset obstacle tools">
            <span className="mr-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Collision tool</span>
            <Button type="button" variant={tool === 'cell' ? 'default' : 'ghost'} size="sm" aria-label="Cell obstacle" aria-pressed={tool === 'cell'} onClick={() => setTool('cell')}><Square />Cell</Button>
            <Button type="button" variant={tool === 'edge' ? 'default' : 'ghost'} size="sm" aria-label="Edge obstacle" aria-pressed={tool === 'edge'} onClick={() => setTool('edge')}><Minus />Edge</Button>
            <span className="ml-3 text-[10px] text-muted-foreground">{selected.kind !== 'grid' && selected.kind !== 'a5' ? 'Cell blocks the surface; Edge blocks only the exterior boundary of each auto-tiled area.' : 'Click a terrain region or its nearest edge. Red cells and orange edges are blocked.'}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-6">
            <div className="mb-3 flex items-center gap-2 text-[10px] text-muted-foreground"><FolderOpen className="size-3.5" /><span>Source image · actual size (1:1)</span><span>·</span><span>{selected.columns * selected.tileSize}×{selected.rows * selected.tileSize}px</span></div>
            <TilesetCanvas tileset={selected} imageUrl={assetUrls[selected.image]} tool={tool} onChange={(terrainId, collision) => onChangeTerrainCollision(selected.id, terrainId, collision)} />
          </div>
        </section> : <section className="grid place-items-center bg-muted/20"><div className="max-w-xs text-center"><ImagePlus className="mx-auto mb-3 size-7 text-muted-foreground" /><h2 className="text-sm font-medium">No project tilesets</h2><p className="mt-1 text-xs text-muted-foreground">Import a PNG or choose one from the Assets Library to get started.</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>Open Assets Library</Button><Button size="sm" onClick={() => setImportOpen(true)}>Import PNG</Button></div></div></section>}
      </div>
      <DialogFooter className="border-t px-5 py-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
    </DialogContent></Dialog>

    <LibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} game={game} assetUrls={assetUrls} library={library} sprites={sprites} bundles={bundles} onImport={onImportLibrary} onImportSprite={onImportSprite} onImportBundle={onImportLibraryBundle} />
    <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImportLocal} />
    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent>
      <DialogHeader><DialogTitle>Tileset details</DialogTitle><DialogDescription>Change the display name and category for this project tileset.</DialogDescription></DialogHeader>
      <div className="space-y-3"><div><Label htmlFor="edit-tileset-name">Name</Label><Input id="edit-tileset-name" autoFocus value={editName} onChange={event => setEditName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveMetadata(); }} /></div><div><Label htmlFor="edit-tileset-category">Category</Label><Input id="edit-tileset-category" list="asset-categories" value={editCategory} onChange={event => setEditCategory(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveMetadata(); }} /></div></div>
      <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={!editName.trim() || !editCategory.trim()} onClick={saveMetadata}>Save changes</Button></DialogFooter>
    </DialogContent></Dialog>
    <datalist id="asset-categories">{categories.map(item => <option key={item} value={item} />)}</datalist>
  </>;
}
