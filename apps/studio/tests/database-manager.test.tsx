import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/components/database-manager';
import { createEmptyProject } from '../src/lib/source-game';

function setupGame() {
  const game = createEmptyProject('Database test').game;
  game.items = {
    potion: { name: 'Potion', type: 'consumable', healing: 25 },
    sword: { name: 'Sword', type: 'equipment', stats: { attack: 4 } },
  };
  game.initialState.variables.score = { name: 'Score', initialValue: 0 };
  game.initialState.switches['door-open'] = { name: 'Door open', initialValue: false };
  game.maps['map-1'].events.push({
    id: 'score-event', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
      movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
      options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
      priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
      contents: [{ type: 'setVariable', id: 'score', operation: 'add', operand: { kind: 'constant', value: 1 } }],
    }],
  });
  return game;
}

function props(overrides: Partial<ComponentProps<typeof DatabaseManager>> = {}): ComponentProps<typeof DatabaseManager> {
  return {
    game: setupGame(),
    onCreateItem: vi.fn(() => 'new-item'), onUpdateItem: vi.fn(), onDuplicateItem: vi.fn(() => 'item-copy'), onDeleteItem: vi.fn(),
    onCreateSkill: vi.fn(() => 'new-skill'), onUpdateSkill: vi.fn(), onDuplicateSkill: vi.fn(() => 'skill-copy'), onDeleteSkill: vi.fn(),
    onCreateType: vi.fn(() => 1), onRenameType: vi.fn(), onDeleteType: vi.fn(),
    onRenameVariable: vi.fn(), onRenameSwitch: vi.fn(),
    assetUrls: {}, onImportLocal: vi.fn(), onUpdate: vi.fn(), onChangeTerrainCollision: vi.fn(),
    ...overrides,
  };
}

describe('DatabaseManager', () => {
  it('switches between the first-level menu and second-level entry lists', async () => {
    render(<DatabaseManager {...props()} />);
    const menu = screen.getByRole('navigation', { name: 'Database sections' });
    expect(menu.closest('[data-database-sidebar]')).toHaveAttribute('data-database-sidebar', 'sections');
    expect(within(menu).getByRole('button', { name: 'Items' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Tilesets' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Skills' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Types' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Variables' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Switches' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByText('Game')).toBeInTheDocument();
    expect(within(menu).queryByText('Project')).not.toBeInTheDocument();
    expect(within(menu).getByText('System')).toBeInTheDocument();
    expect(within(menu).getAllByText('2')[0]).toHaveAttribute('data-slot', 'sidebar-menu-badge');
    expect(screen.getByRole('list', { name: 'Items' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Items' }).closest('[data-database-sidebar]')).toHaveAttribute('data-database-sidebar', 'entries');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search items' }), 'potion');
    expect(screen.getByRole('button', { name: /Potion/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sword/ })).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('button', { name: 'Skills' }));
    expect(screen.getByRole('list', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getAllByText('Basic attack')).toHaveLength(2);
  });

  it('keeps project tilesets in the database', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Tilesets' }));
    expect(screen.getByText('Project tilesets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import PNG' })).toBeInTheDocument();
  });

  it('renames system entries and lists their usages', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Variables' }));
    expect(screen.getByRole('list', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Variable initial value' })).toHaveValue('0');
    expect(screen.getByText('Map 1 · score-event · page 1')).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Variable name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Player score');
    await userEvent.tab();
    expect(values.onRenameVariable).toHaveBeenCalledWith('score', 'Player score');
  });

  it('creates an item and duplicates the selected entry', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create item' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New entry name' }), 'Ether');
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(values.onCreateItem).toHaveBeenCalledWith('Ether', 'consumable');
    await userEvent.click(screen.getByRole('button', { name: /Potion/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(values.onDuplicateItem).toHaveBeenCalledWith('potion');
  });

  it('shows conditional item fields and the missing equipment slot state', async () => {
    const game = setupGame();
    game.types.equipment = { nextId: 1, entries: [] };
    render(<DatabaseManager {...props({ game })} />);
    expect(screen.getByRole('spinbutton', { name: 'Item healing' })).toHaveValue(25);
    await userEvent.click(screen.getByRole('button', { name: /Sword/ }));
    expect(screen.getByText('No equipment types are configured for this project yet.')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Stat value attack' })).toHaveValue(4);
  });

  it('blocks deletion when the selected skill is referenced', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Skills' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot delete Basic attack');
    expect(screen.getByText('Player primary attack')).toBeInTheDocument();
    expect(values.onDeleteSkill).not.toHaveBeenCalled();
  });

  it('confirms deletion of an unreferenced item', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Potion?');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(values.onDeleteItem).toHaveBeenCalledWith('potion');
  });

  it('creates and renames numeric types within the selected category', async () => {
    const game = setupGame();
    game.types.elements = { nextId: 2, entries: [{ id: 1, name: 'Fire' }] };
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Types' }));
    expect(screen.getByRole('list', { name: 'Type categories' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Elements name 1' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Flame');
    await userEvent.tab();
    expect(values.onRenameType).toHaveBeenCalledWith('elements', 1, 'Flame');
    await userEvent.click(screen.getByRole('button', { name: 'Create Elements' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New type name' }), 'Ice');
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(values.onCreateType).toHaveBeenCalledWith('elements', 'Ice');
  });

  it('blocks deletion of a referenced equipment type', async () => {
    const game = setupGame();
    game.types.equipment = { nextId: 2, entries: [{ id: 1, name: 'Weapon' }] };
    game.items.sword.equipmentTypeId = 1;
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Types' }));
    await userEvent.click(screen.getByRole('button', { name: 'Equipment Types' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Weapon' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot delete Weapon');
    expect(screen.getByText('items.sword.equipmentTypeId')).toBeInTheDocument();
    expect(values.onDeleteType).not.toHaveBeenCalled();
  });
});
