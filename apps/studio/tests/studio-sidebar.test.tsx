import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GameMap, SourceGame } from '@rpgcrafter/game-schema';
import { StudioSidebar } from '../src/components/studio-sidebar';

const event = {
  id: 'mayor', position: { x: 2, y: 3, planeId: 'p' }, scriptId: 'event.mayor',
  trigger: { type: 'interact' as const, radius: 1 }, execution: { mode: 'repeat' as const },
  visual: { type: 'npc' as const, name: 'Mayor', color: '#ffffff', radius: 18 },
};
const map: GameMap = {
  id: 'village', name: 'Village', ground: '#000000', accent: '#ffffff', tileSize: 48,
  bounds: { x: 0, y: 0, w: 10, h: 8 },
  planes: [{ id: 'p', name: 'My plane', order: 0, surfaceLayerId: 'details', surfaceCoverage: 'bounds' }],
  tileLayers: [
    { id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors', tiles: [] },
    { id: 'details', name: 'Details', planeId: 'p', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 2, tilesetId: 'outside-a2', terrainId: 'grass' }] },
  ],
  events: [event], planeConnections: [], navigationOverrides: [], blockedRegions: [], enemySpawns: [],
};
const game = {
  maps: { village: map },
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
  game, assetUrls: { 'tilesets/outside-a2.png': 'outside.png' }, map, selectedMapId: 'village', selectedEventId: null,
  selectedTerrain: null, activeLayerId: 'ground', onSelectMap: vi.fn(), onSelectEvent: vi.fn(), onChangeMode: vi.fn(), onSelectTerrain: vi.fn(),
  onCreateMap: vi.fn(), onRenameMap: vi.fn(), onMoveMap: vi.fn(), onReorderMap: vi.fn(), onResizeMap: vi.fn(),
  onSelectLayer: vi.fn(), onAddLayer: vi.fn(), onRenameLayer: vi.fn(), onDeleteLayer: vi.fn(), onMoveLayer: vi.fn(),
  onChangeLayerPlane: vi.fn(), onChangeLayerPhase: vi.fn(), onAddPlane: vi.fn(), onRenamePlane: vi.fn(), onMovePlane: vi.fn(), onDeletePlane: vi.fn(), onChangeCoverage: vi.fn(), onChangeSurface: vi.fn(), onDeleteConnection: vi.fn(),
};

describe('StudioSidebar', () => {
  it('lists map events and synchronizes selection', async () => {
    const onSelectEvent = vi.fn();
    render(<StudioSidebar {...common} mode="events" onSelectEvent={onSelectEvent} />);
    await userEvent.click(screen.getByRole('button', { name: /Mayor/ }));
    expect(onSelectEvent).toHaveBeenCalledWith('mayor');
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
    const tilesHeader = screen.getByText('Tiles').closest<HTMLElement>('[data-slot="collapsible-trigger"]');
    const tilesContent = tilesHeader?.parentElement?.nextElementSibling;

    expect(sidebar).toHaveClass('cursor-default', 'border-r');
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
    await userEvent.click(screen.getByRole('button', { name: 'Add map' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create map' }));
    expect(onCreateMap).toHaveBeenCalledWith(20, 15);
    await userEvent.click(screen.getByRole('button', { name: 'Map settings: Village' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply size' }));
    expect(onResizeMap).toHaveBeenCalledWith('village', 10, 8);
  });

  it('renames a map inline on double click', async () => {
    const onRenameMap = vi.fn();
    render(<StudioSidebar {...common} mode="drawing" onRenameMap={onRenameMap} />);

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

    expect(screen.getByRole('tree', { name: 'Map hierarchy' })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Map hierarchy' })).not.toHaveClass('p-1');
    expect(screen.getByText('Mayor House')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add sub-map to Village' })).not.toBeInTheDocument();
    expect(screen.getByText('Village').closest('[data-map-row-id]')).toHaveAttribute('draggable', 'true');
    expect(screen.getByText('Mayor House').closest('[data-map-row-id]')).toHaveAttribute('draggable', 'true');
    expect(screen.queryByRole('img', { name: /Reorder/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Map settings: Mayor House' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Parent map' }), '');
    expect(onMoveMap).toHaveBeenCalledWith('house', null);
  });

  it('collapses and expands parent maps with a chevron', async () => {
    const child = { ...structuredClone(map), id: 'house', name: 'Mayor House', parentMapId: 'village' };
    const nestedGame = { ...game, maps: { village: map, house: child } } as unknown as SourceGame;
    render(<StudioSidebar {...common} game={nestedGame} mode="drawing" />);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Village' }));
    expect(screen.queryByText('Mayor House')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Village' }));
    expect(screen.getByText('Mayor House')).toBeInTheDocument();
  });

  it('nests sibling maps by dropping on the center of a row', () => {
    const town = { ...structuredClone(map), id: 'town', name: 'Town' };
    const reorderGame = { ...game, maps: { village: map, town } } as unknown as SourceGame;
    const onReorderMap = vi.fn();
    render(<StudioSidebar {...common} game={reorderGame} mode="drawing" onReorderMap={onReorderMap} />);
    const source = screen.getByText('Town').closest('[data-map-row-id]')!;
    const target = screen.getByText('Village').closest('[data-map-row-id]')!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect);
    const dataTransfer = { effectAllowed: 'none', dropEffect: 'none', setData: vi.fn() };

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY: 105 });
    fireEvent.drop(target, { dataTransfer, clientY: 105 });

    expect(onReorderMap).toHaveBeenCalledWith('town', 'village', 'inside');
  });

  it('keeps plane and layer configuration out of drawing mode', () => {
    render(<StudioSidebar {...common} mode="drawing" />);
    expect(screen.queryByText('Planes & layers')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add plane or layer' })).not.toBeInTheDocument();
    expect(screen.getByText('Tiles')).toBeInTheDocument();
  });
});
