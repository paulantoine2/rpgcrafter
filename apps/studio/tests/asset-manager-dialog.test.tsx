import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SourceGame, TilesetDefinition } from '@rpgcrafter/game-schema';
import { AssetManagerDialog, type LibrarySprite, type LibraryTileset } from '../src/components/asset-manager-dialog';

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
  const library: LibraryTileset = {
    kind: 'tileset',
    definition: libraryDefinition,
    blob: new Blob(['png'], { type: 'image/png' }),
    configurationPath: 'tilesets/library-decor.json',
    configurationBlob: new Blob([JSON.stringify(libraryDefinition)], { type: 'application/json' }),
    url: 'library.png',
    assetType: 'tileset',
    bundleId: 'starter-pack',
    bundleName: 'Starter Pack',
    tags: ['sci-fi', 'inside'],
  };
  const bundle = { id: 'starter-pack', name: 'Starter Pack', version: 1, assets: [library] };
  return {
    open: true,
    onOpenChange: vi.fn(),
    game: { tilesets: { decor: grid, cliffs: a2 } } as unknown as SourceGame,
    assetUrls: { 'tilesets/decor.png': 'decor.png', 'tilesets/cliffs.png': 'cliffs.png' },
    library: [library],
    sprites: [],
    bundles: [bundle],
    onImportLibrary: vi.fn(),
    onImportSprite: vi.fn(),
    onImportLibraryBundle: vi.fn(),
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
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets Library' }));
    expect(screen.getByRole('dialog', { name: 'Assets Library' })).toBeInTheDocument();
    expect(screen.getByText('Tileset')).toBeInTheDocument();
    expect(screen.getByText('Bundle · Starter Pack')).toBeInTheDocument();
    expect(screen.getByText('sci-fi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onImportLibrary).toHaveBeenCalledWith(values.library[0]);
    expect(values.library[0].definition.terrains[0].collision).toEqual({ kind: 'edges', edges: ['west'] });
  });

  it('switches to Bundles and imports every remaining asset in a bundle', async () => {
    const onImportLibraryBundle = vi.fn();
    const values = props({ onImportLibraryBundle });
    render(<AssetManagerDialog {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets Library' }));
    expect(screen.getByRole('tab', { name: 'Tilesets' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Bundles' }));
    expect(screen.getByRole('tabpanel', { name: 'Bundles' })).toBeInTheDocument();
    expect(screen.getByText('Starter Pack')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import bundle (1)' }));
    expect(onImportLibraryBundle).toHaveBeenCalledWith(values.bundles[0]);
  });

  it('searches assets by tag, type, and parent bundle', async () => {
    const values = props();
    render(<AssetManagerDialog {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets Library' }));
    const search = screen.getByRole('searchbox', { name: 'Search assets' });
    await userEvent.type(search, 'sci-fi');
    expect(screen.getByText('Library Decor')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'missing-tag');
    expect(screen.getByText('No assets match “missing-tag”.')).toBeInTheDocument();
  });

  it('lists and imports character sprites from the library', async () => {
    const sprite: LibrarySprite = {
      kind: 'sprite', id: 'actor-1', name: 'Actor 1', blob: new Blob(['png'], { type: 'image/png' }), imagePath: 'sprites/rpg-maker-mz/Actor1.png', url: 'actor.png', assetType: 'character-sprite', bundleId: 'rpg-maker-mz', bundleName: 'RPG Maker MZ', tags: ['fantasy'],
      layout: { characterCount: 8, frameWidth: 48, frameHeight: 48, objectAligned: false },
    };
    const onImportSprite = vi.fn();
    render(<AssetManagerDialog {...props({ sprites: [sprite], onImportSprite })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets Library' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Sprites' }));
    expect(screen.getByText('Actor 1')).toBeInTheDocument();
    expect(screen.getByText('8 characters · 48×48px frames')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('tabpanel', { name: 'Sprites' })).getByRole('button', { name: 'Import' }));
    expect(onImportSprite).toHaveBeenCalledWith(sprite);
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
