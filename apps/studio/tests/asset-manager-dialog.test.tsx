import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SourceGame, TilesetDefinition } from '@rpgcrafter/game-schema';
import { AssetManagerDialog, type LibraryTileset } from '../src/components/asset-manager-dialog';

const grid: TilesetDefinition = {
  id: 'decor', name: 'Decor', category: 'Nature', kind: 'grid', image: 'tilesets/decor.png', tileSize: 48, columns: 2, rows: 1,
  terrains: [
    { id: 'moss', name: 'Moss', origin: { column: 0, row: 0 }, collision: { kind: 'none' } },
    { id: 'trunk', name: 'Trunk', origin: { column: 1, row: 0 }, collision: { kind: 'blockCell' } },
  ],
};
const a2: TilesetDefinition = {
  id: 'cliffs', name: 'Cliffs', category: 'Nature', kind: 'a2', image: 'tilesets/cliffs.png', tileSize: 48, quarterSize: 24, columns: 2, rows: 3,
  terrains: [{ id: 'cliff', name: 'Cliff', origin: { column: 0, row: 0 }, previewMask: 0, collision: { kind: 'edges', edges: ['east'] } }],
  variants: { '0': { quarters: [[0, 0], [1, 0], [0, 1], [1, 1]] } },
};
const libraryDefinition: TilesetDefinition = {
  ...grid, id: 'library-decor', name: 'Library Decor', image: 'tilesets/library-decor.png',
  terrains: [{ id: 'fence', name: 'Fence', origin: { column: 0, row: 0 }, collision: { kind: 'edges', edges: ['west'] } }],
};

function props(overrides: Record<string, unknown> = {}) {
  const library: LibraryTileset = { definition: libraryDefinition, blob: new Blob(['png'], { type: 'image/png' }), url: 'library.png' };
  return {
    open: true,
    onOpenChange: vi.fn(),
    game: { tilesets: { decor: grid, cliffs: a2 } } as unknown as SourceGame,
    assetUrls: { 'tilesets/decor.png': 'decor.png', 'tilesets/cliffs.png': 'cliffs.png' },
    library: [library],
    onImportLibrary: vi.fn(),
    onImportLocal: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn(),
    onChangeTerrainCollision: vi.fn(),
    ...overrides,
  };
}

describe('AssetManagerDialog obstacle editor', () => {
  it('shows the selected tileset at actual size and toggles whole-cell collisions', async () => {
    const onChangeTerrainCollision = vi.fn();
    render(<AssetManagerDialog {...props({ onChangeTerrainCollision })} />);
    expect(screen.getByRole('list', { name: 'Project tilesets' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Decor source' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Decor obstacle grid' })).toHaveStyle({ width: '96px', height: '48px' });
    const moss = screen.getByRole('gridcell', { name: 'Moss obstacle: none' });
    await userEvent.click(moss);
    expect(onChangeTerrainCollision).toHaveBeenCalledWith('decor', 'moss', { kind: 'blockCell' });
  });

  it('converts a blocked cell to the nearest edge with the Edge tool', async () => {
    const onChangeTerrainCollision = vi.fn();
    render(<AssetManagerDialog {...props({ onChangeTerrainCollision })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edge obstacle' }));
    const trunk = screen.getByRole('gridcell', { name: 'Trunk obstacle: blockCell' });
    expect(trunk.querySelector('[data-obstacle-cell]')).toBeInTheDocument();
    vi.spyOn(trunk, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 48, bottom: 48, width: 48, height: 48, toJSON: () => ({}) });
    fireEvent.click(trunk, { clientX: 47, clientY: 24 });
    expect(onChangeTerrainCollision).toHaveBeenCalledWith('decor', 'trunk', { kind: 'edges', edges: ['east'] });
  });

  it('treats Edge as one auto-tiled boundary toggle for A2 terrains', async () => {
    const onChangeTerrainCollision = vi.fn();
    render(<AssetManagerDialog {...props({ onChangeTerrainCollision })} />);
    await userEvent.click(screen.getByRole('button', { name: 'CliffsNature · A2' }));
    const cliff = screen.getByRole('gridcell', { name: 'Cliff obstacle: edges' });
    expect(screen.getByRole('img', { name: 'Cliffs source' })).toBeInTheDocument();
    expect(cliff).toHaveStyle({ width: '96px', height: '144px' });
    expect(cliff.querySelectorAll('[data-obstacle-edge]')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Edge obstacle' }));
    await userEvent.click(cliff);
    expect(onChangeTerrainCollision).toHaveBeenCalledWith('cliffs', 'cliff', { kind: 'none' });
  });

  it('opens the library in a separate dialog and preserves configured collisions', async () => {
    const onImportLibrary = vi.fn();
    const values = props({ onImportLibrary });
    render(<AssetManagerDialog {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open library' }));
    expect(screen.getByRole('dialog', { name: 'Tileset Library' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImportLibrary).toHaveBeenCalledWith(values.library[0]);
    expect(values.library[0].definition.terrains[0].collision).toEqual({ kind: 'edges', edges: ['west'] });
  });

  it('opens import and metadata forms in separate dialogs', async () => {
    const onUpdate = vi.fn();
    render(<AssetManagerDialog {...props({ onUpdate })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Import PNG' }));
    expect(screen.getByRole('dialog', { name: 'Import a local PNG' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rename & categorize' }));
    expect(screen.getByRole('dialog', { name: 'Tileset details' })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Forest Decor');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onUpdate).toHaveBeenCalledWith('decor', { name: 'Forest Decor', category: 'Nature' });
  });
});
