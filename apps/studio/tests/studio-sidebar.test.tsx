import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GameMap, SourceGame } from '@rpgcrafter/game-schema';
import { StudioSidebar } from '../src/components/studio-sidebar';

const event = {
  id: 'mayor', position: { x: 2, y: 3, planeId: 'p' },
  pages: [{
    movement: { type: 'fixed' as const, speed: 3 as const, frequency: 3 as const, route: [] },
    options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
    priority: 'sameAsCharacters' as const,
    trigger: { type: 'actionButton' as const, radius: 1 },
    sprite: { image: 'sprites/Actor1.png', characterIndex: 0, characterColumns: 4, frameWidth: 48, frameHeight: 48, objectAligned: false },
    contents: [],
  }],
};
const map: GameMap = {
  id: 'village', numericId: 1, name: 'Village', ground: '#000000', accent: '#ffffff', tileSize: 48,
  bounds: { x: 0, y: 0, w: 10, h: 8 },
  planes: [{ id: 'p', name: 'My plane', order: 0, surfaceLayerId: 'details', surfaceCoverage: 'bounds' }],
  tileLayers: [
    { id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors', tiles: [] },
    { id: 'details', name: 'Details', planeId: 'p', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 2, tilesetId: 'outside-a2', terrainId: 'grass' }] },
  ],
  events: [event], planeConnections: [], navigationOverrides: [], blockedRegions: [], enemySpawns: [],
};
const game = {
  manifest: { title: 'Test Project' },
  maps: { village: map },
  initialState: { switches: {}, variables: {}, quests: {}, inventory: {}, equipment: {} },
  tilesets: {
    'outside-a2': {
      id: 'outside-a2', name: 'Outside A2', category: 'Sol', kind: 'a2', image: 'tilesets/outside-a2.png', tileSize: 48, quarterSize: 24, columns: 16, rows: 12,
      terrains: [
        { id: 'grass', name: 'Grass', origin: { column: 0, row: 0 }, previewMask: 255 },
        { id: 'dirt', name: 'Dirt', origin: { column: 2, row: 0 }, previewMask: 255 },
      ],
      variants: {
        '0': { quarters: [[0, 0], [1, 0], [0, 1], [1, 1]] },
        '255': { quarters: [[2, 4], [1, 4], [2, 3], [1, 3]] },
      },
    },
  },
} as unknown as SourceGame;
const common = {
  game, assetUrls: { 'tilesets/outside-a2.png': 'outside.png', 'sprites/Actor1.png': 'actor1.png' }, map, selectedMapId: 'village', selectedEventId: null,
  selectedTerrain: null, activeLayerId: 'ground', onSelectMap: vi.fn(), onSelectEvent: vi.fn(), onRenameEvent: vi.fn(), onChangeMode: vi.fn(), onSelectTerrain: vi.fn(),
  canPlay: true, onPlay: vi.fn(),
  onCreateMap: vi.fn(), onRenameMap: vi.fn(), onMoveMap: vi.fn(), onReorderMap: vi.fn(), onResizeMap: vi.fn(),
  onSelectLayer: vi.fn(), onAddLayer: vi.fn(), onRenameLayer: vi.fn(), onDeleteLayer: vi.fn(), onMoveLayer: vi.fn(),
  onChangeLayerPlane: vi.fn(), onChangeLayerPhase: vi.fn(), onAddPlane: vi.fn(), onRenamePlane: vi.fn(), onMovePlane: vi.fn(), onDeletePlane: vi.fn(), onChangeCoverage: vi.fn(), onChangeSurface: vi.fn(), onDeleteConnection: vi.fn(),
};

async function expandMaps() {
  const mapsTrigger = screen.getByRole('button', { name: 'Maps' });
  expect(mapsTrigger).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(mapsTrigger);
  expect(mapsTrigger).toHaveAttribute('aria-expanded', 'true');
}

describe('StudioSidebar', () => {
  it('shows the project header above Maps while keeping the editor section fixed open', () => {
    const { container } = render(<StudioSidebar {...common} mode="events" />);
    expect(screen.getByText('Test Project').closest('[data-slot="studio-project-header"]')).toHaveClass('h-16', 'px-4');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    const mapsTrigger = screen.getByRole('button', { name: 'Maps' });
    const mapsHeader = mapsTrigger.closest<HTMLElement>('[data-slot="section-header"]')!;
    const eventsHeader = screen.getByText('Events').closest<HTMLElement>('[data-slot="section-header"]')!;
    const mapsResizeHandle = screen.getByRole('separator');

    expect(mapsTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(mapsHeader).toHaveClass('border-t-0');
    expect(eventsHeader).toHaveClass('border-t-0');
    expect(eventsHeader).toHaveClass('px-4', 'py-4', 'h-12');
    expect(mapsHeader).toHaveClass('px-4', 'py-4', 'h-12');
    expect(eventsHeader).toHaveClass('pr-3');
    expect(mapsHeader).toHaveClass('pr-3');
    expect(mapsTrigger.querySelector('.lucide-chevron-right')).toHaveClass('absolute', '-left-3.5');
    expect(mapsHeader.closest('[data-panel]')).toHaveAttribute('data-disabled', 'true');
    expect(mapsResizeHandle).toHaveAttribute('aria-disabled', 'true');
    expect(eventsHeader.nextElementSibling).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden');
    expect(eventsHeader.nextElementSibling?.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(eventsHeader.nextElementSibling).not.toContainElement(eventsHeader);
    expect(screen.queryByRole('tree', { name: 'Map hierarchy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Events' })).not.toBeInTheDocument();
    expect(mapsTrigger.compareDocumentPosition(eventsHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="section-header"]')).toHaveLength(2);
  });

  it('only enables resizing while the resizable section is open', async () => {
    render(<StudioSidebar {...common} mode="events" />);
    const mapsTrigger = screen.getByRole('button', { name: 'Maps' });
    const resizeHandle = screen.getAllByRole('separator')[0];
    const mapsPanel = mapsTrigger.closest('[data-panel]');

    expect(mapsPanel).toHaveAttribute('data-disabled', 'true');
    expect(resizeHandle).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(mapsTrigger);
    expect(mapsPanel).not.toHaveAttribute('data-disabled');
    expect(resizeHandle).not.toHaveAttribute('aria-disabled');

    await userEvent.click(mapsTrigger);
    expect(mapsPanel).toHaveAttribute('data-disabled', 'true');
    expect(resizeHandle).toHaveAttribute('aria-disabled', 'true');
  });

  it('colors the fixed header border without changing its width when content scrolls', () => {
    const { container } = render(<StudioSidebar {...common} mode="events" />);
    const eventsHeader = screen.getByText('Events').closest('[data-slot="section-header"]')!;
    const viewport = container.querySelector<HTMLElement>('[data-slot="section-content"] [data-slot="scroll-area-viewport"]')!;

    expect(eventsHeader).toHaveClass('border-b', 'border-b-transparent');
    expect(eventsHeader).not.toHaveClass('border-b-border');

    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 24 });
    fireEvent.scroll(viewport);
    expect(eventsHeader).toHaveClass('border-b', 'border-b-border');
    expect(eventsHeader).not.toHaveClass('border-b-transparent');

    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 0 });
    fireEvent.scroll(viewport);
    expect(eventsHeader).toHaveClass('border-b', 'border-b-transparent');
    expect(eventsHeader).not.toHaveClass('border-b-border');
  });

  it('lists map events and synchronizes selection', async () => {
    const onSelectEvent = vi.fn();
    const { container } = render(<StudioSidebar {...common} mode="events" onSelectEvent={onSelectEvent} />);
    const eventRow = container.querySelector<HTMLElement>('[data-event-row-id="mayor"]')!;
    const eventSprite = eventRow.querySelector<HTMLElement>('[data-slot="event-sprite"]')!;
    expect(eventRow).toHaveRole('button');
    expect(eventRow).toHaveClass('rounded-md', 'py-0.5');
    expect(eventRow.parentElement).toHaveClass('px-2', 'py-1', 'space-y-1');
    expect(eventSprite.querySelector('[style*="background-image"]')).toHaveStyle({ backgroundImage: 'url("actor1.png")' });
    expect(screen.queryByText('interact')).not.toBeInTheDocument();
    await userEvent.click(eventSprite);
    expect(onSelectEvent).toHaveBeenCalledWith('mayor');
  });

  it('renames an event inline on double click', async () => {
    const onRenameEvent = vi.fn();
    render(<StudioSidebar {...common} mode="events" onRenameEvent={onRenameEvent} />);

    await userEvent.dblClick(screen.getByText('mayor'));
    const input = screen.getByRole('textbox', { name: 'Rename event: mayor' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'village-mayor' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameEvent).toHaveBeenCalledWith('mayor', 'village-mayor');
    expect(screen.queryByRole('textbox', { name: 'Rename event: mayor' })).not.toBeInTheDocument();
  });

  it('shows an empty event state', () => {
    const emptyMap = { ...map, events: [] };
    render(<StudioSidebar {...common} map={emptyMap} mode="events" />);
    expect(screen.getByText('No events on this map.')).toBeInTheDocument();
  });

  it('renders and selects only declared logical terrains', async () => {
    const onSelectTerrain = vi.fn();
    render(<StudioSidebar {...common} mode="drawing" onSelectTerrain={onSelectTerrain} />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(2);
    await userEvent.click(screen.getByRole('gridcell', { name: 'Dirt' }));
    expect(onSelectTerrain).toHaveBeenCalledWith({ tilesetId: 'outside-a2', terrainId: 'dirt' });
  });

  it('keeps the Tiles header outside its constrained scrollable content', () => {
    const { container } = render(<StudioSidebar {...common} mode="drawing" />);
    const sidebar = container.querySelector<HTMLElement>('[data-slot="studio-sidebar"]');
    const tilesHeader = screen.getByText('Tiles').closest<HTMLElement>('[data-slot="section-header"]');
    const tilesContent = tilesHeader?.nextElementSibling;

    expect(sidebar).toHaveClass('cursor-default', 'border-r', 'bg-sidebar', 'text-sidebar-foreground');
    expect(screen.queryByRole('button', { name: 'Tiles' })).not.toBeInTheDocument();
    expect(tilesContent).toHaveClass('overflow-hidden');
    expect(tilesContent?.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(tilesContent?.querySelector('[data-slot="scroll-area"]')).not.toContainElement(tilesHeader);
  });

  it('shows grid tilesets in eight-column vertical bands', () => {
    const terrains = Array.from({ length: 2 }, (_, row) => Array.from({ length: 16 }, (_, column) => ({
      id: `tile-${row}-${column}`,
      name: `Tile ${row}-${column}`,
      origin: { column, row },
      collision: { kind: 'none' as const },
    }))).flat();
    const gridGame = {
      ...game,
      tilesets: {
        decor: { id: 'decor', name: 'Decor', category: 'Nature', kind: 'grid', image: 'tilesets/decor.png', tileSize: 48, columns: 16, rows: 2, terrains },
      },
    } as unknown as SourceGame;

    render(<StudioSidebar {...common} game={gridGame} assetUrls={{ 'tilesets/decor.png': 'decor.png' }} mode="drawing" />);

    const palette = screen.getByRole('grid', { name: 'Decor tileset' });
    expect(palette).toHaveAttribute('aria-colcount', '8');
    expect(screen.getAllByRole('gridcell').map(cell => cell.getAttribute('aria-label'))).toEqual([
      ...Array.from({ length: 2 }, (_, row) => Array.from({ length: 8 }, (_, column) => `Tile ${row}-${column}`)).flat(),
      ...Array.from({ length: 2 }, (_, row) => Array.from({ length: 8 }, (_, column) => `Tile ${row}-${column + 8}`)).flat(),
    ]);
    expect(screen.getByRole('gridcell', { name: 'Tile 0-8' })).toHaveStyle({ gridColumnStart: '1', gridRowStart: '3' });
  });

  it('uses the four-corner isolated variant for terrain previews', () => {
    const { container } = render(<StudioSidebar {...common} mode="drawing" />);
    const grass = container.querySelector('[role="gridcell"][aria-label="Grass"]')!;
    expect(grass.querySelector('[data-preview-mask]')).toHaveAttribute('data-preview-mask', '0');
  });

  it('keeps global collision editing out of the drawing palette', () => {
    render(<StudioSidebar {...common} mode="drawing" />);
    expect(screen.queryByText('Terrain collision')).not.toBeInTheDocument();
  });

  it('creates and resizes maps from side popovers', async () => {
    const onCreateMap = vi.fn();
    const onResizeMap = vi.fn();
    render(<StudioSidebar {...common} mode="drawing" onCreateMap={onCreateMap} onResizeMap={onResizeMap} />);
    await expandMaps();
    expect(screen.getByText('#1')).toBeInTheDocument();
    const addMap = screen.getByRole('button', { name: 'Add map' });
    expect(addMap).toHaveAttribute('data-base-ui-tooltip-trigger');
    await userEvent.click(addMap);
    const newMapHeader = screen.getByText('New map').closest('[data-slot="section-header"]');
    expect(newMapHeader).toHaveClass('h-12', 'px-4', 'py-4');
    expect(newMapHeader?.closest('[data-slot="popover-panel"]')).toHaveClass('rounded-lg', 'bg-popover', 'text-popover-foreground');
    await userEvent.click(screen.getByRole('button', { name: 'Create map' }));
    expect(onCreateMap).toHaveBeenCalledWith(20, 15);
    const mapSettings = screen.getByRole('button', { name: 'Map settings: Village' });
    expect(mapSettings).toHaveAttribute('data-base-ui-tooltip-trigger');
    await userEvent.click(mapSettings);
    const mapSettingsHeader = screen.getByText('Map settings').closest('[data-slot="section-header"]');
    expect(mapSettingsHeader).toHaveClass('h-12', 'px-4', 'py-4');
    expect(mapSettingsHeader?.closest('[data-slot="popover-panel"]')).toHaveClass('rounded-lg', 'bg-popover', 'text-popover-foreground');
    expect(screen.getByRole('textbox', { name: 'Numeric map ID' })).toHaveValue('1');
    expect(screen.getByRole('textbox', { name: 'Numeric map ID' })).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', { name: 'Apply size' }));
    expect(onResizeMap).toHaveBeenCalledWith('village', 10, 8);
  });

  it('renames a map inline on double click', async () => {
    const onRenameMap = vi.fn();
    render(<StudioSidebar {...common} mode="drawing" onRenameMap={onRenameMap} />);
    await expandMaps();

    await userEvent.dblClick(screen.getByText('Village'));
    const input = screen.getByRole('textbox', { name: 'Rename map: Village' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Town Square' } });
    expect(input).toHaveValue('Town Square');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameMap).toHaveBeenCalledWith('village', 'Town Square');
    expect(screen.queryByRole('textbox', { name: 'Rename map: Village' })).not.toBeInTheDocument();
  });

  it('renders draggable nested maps without reorder handles and supports changing their parent', async () => {
    const child = { ...structuredClone(map), id: 'house', name: 'Mayor House', parentMapId: 'village' };
    const nestedGame = { ...game, maps: { village: map, house: child } } as unknown as SourceGame;
    const onMoveMap = vi.fn();
    render(<StudioSidebar {...common} game={nestedGame} mode="drawing" onMoveMap={onMoveMap} />);
    await expandMaps();

    expect(screen.getByRole('tree', { name: 'Map hierarchy' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Map hierarchy' })).toHaveClass('px-2', 'space-y-0', 'py-0', 'pb-1');
    expect(screen.getByText('Mayor House')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add sub-map to Village' })).not.toBeInTheDocument();
    expect(screen.getByText('Village').closest('[data-map-row-id]')).toHaveAttribute('draggable', 'true');
    expect(screen.getByText('Village').closest('[data-map-row-id]')).toHaveClass('min-h-8', 'rounded-md');
    expect(screen.getByText('Mayor House').closest('[data-map-row-id]')).toHaveAttribute('draggable', 'true');
    expect(document.querySelector('[data-map-separator-before="house"]')).toHaveClass('h-1');
    expect(screen.getByText('Mayor House').closest('[data-map-row-id]')).not.toHaveClass('border-y');
    expect(screen.queryByRole('img', { name: /Reorder/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Map settings: Mayor House' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Parent map' }), '');
    expect(onMoveMap).toHaveBeenCalledWith('house', null);
  });

  it('collapses and expands parent maps with a chevron', async () => {
    const child = { ...structuredClone(map), id: 'house', name: 'Mayor House', parentMapId: 'village' };
    const nestedGame = { ...game, maps: { village: map, house: child } } as unknown as SourceGame;
    render(<StudioSidebar {...common} game={nestedGame} mode="drawing" />);
    await expandMaps();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Village' }));
    expect(screen.queryByText('Mayor House')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Village' }));
    expect(screen.getByText('Mayor House')).toBeInTheDocument();
  });

  it('nests sibling maps by dropping on the center of a row', async () => {
    const town = { ...structuredClone(map), id: 'town', name: 'Town' };
    const reorderGame = { ...game, maps: { village: map, town } } as unknown as SourceGame;
    const onReorderMap = vi.fn();
    render(<StudioSidebar {...common} game={reorderGame} mode="drawing" onReorderMap={onReorderMap} />);
    await expandMaps();
    const source = screen.getByText('Town').closest('[data-map-row-id]')!;
    const target = screen.getByText('Village').closest('[data-map-row-id]')!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect);
    const dataTransfer = { effectAllowed: 'none', dropEffect: 'none', setData: vi.fn() };

    fireEvent.dragStart(source, { dataTransfer });
    const dragOverEvent = createEvent.dragOver(target, { dataTransfer });
    Object.defineProperty(dragOverEvent, 'clientY', { value: 120 });
    fireEvent(target, dragOverEvent);
    fireEvent.drop(target, { dataTransfer });

    expect(onReorderMap).toHaveBeenCalledWith('town', 'village', 'inside');
  });

  it('highlights the separator instead of the rounded map row when reordering', async () => {
    const town = { ...structuredClone(map), id: 'town', name: 'Town' };
    const reorderGame = { ...game, maps: { village: map, town } } as unknown as SourceGame;
    render(<StudioSidebar {...common} game={reorderGame} mode="drawing" />);
    await expandMaps();
    const source = screen.getByText('Town').closest('[data-map-row-id]')!;
    const target = screen.getByText('Village').closest('[data-map-row-id]')!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect);
    const dataTransfer = { effectAllowed: 'none', dropEffect: 'none', setData: vi.fn() };

    fireEvent.dragStart(source, { dataTransfer });
    const dragOverEvent = createEvent.dragOver(target, { dataTransfer });
    Object.defineProperty(dragOverEvent, 'clientY', { value: 105 });
    fireEvent(target, dragOverEvent);

    expect(document.querySelector('[data-map-separator-before="village"] > div')).toHaveClass('bg-primary');
    expect(target).not.toHaveClass('border-t-primary', 'border-b-primary');
  });

  it('keeps plane and layer configuration out of drawing mode', () => {
    render(<StudioSidebar {...common} mode="drawing" />);
    expect(screen.queryByText('Planes & layers')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add plane or layer' })).not.toBeInTheDocument();
    expect(screen.getByText('Tiles')).toBeInTheDocument();
  });
});
