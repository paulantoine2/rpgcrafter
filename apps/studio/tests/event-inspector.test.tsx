import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EventCommand, MapEvent, SourceGame } from '@rpgcrafter/game-schema';
import { EventInspector } from '../src/components/event-inspector';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { createMapEventAt } from '../src/lib/editor-events';
import { createEmptyProject } from '../src/lib/source-game';

function Harness({ emptySwitches = false, emptyVariables = false, withSprite = false, initialContents = [], onEventChange }: { emptySwitches?: boolean; emptyVariables?: boolean; withSprite?: boolean; initialContents?: EventCommand[]; onEventChange?: (event: MapEvent) => void }) {
  const project = createEmptyProject('Inspector');
  const [switches, setSwitches] = useState<SourceGame['initialState']['switches']>(emptySwitches ? {} : {
      'door-open': { name: 'Door open', initialValue: false },
      'boss-defeated': { name: 'Boss defeated', initialValue: false },
  });
  project.game.initialState.switches = switches;
  const [items, setItems] = useState<SourceGame['items']>({
    potion: { name: 'Potion', type: 'consumable', healing: 25 },
    'silver-sword': { name: 'Silver Sword', type: 'equipment', equipmentSlot: 'weapon' },
  });
  project.game.items = items;
  const [variables, setVariables] = useState<SourceGame['initialState']['variables']>(emptyVariables ? {} : {
    score: { name: 'Score', initialValue: 0 },
    reputation: { name: 'Reputation', initialValue: 0 },
  });
  project.game.initialState.variables = variables;
  const [event, setEvent] = useState<MapEvent>(() => {
    const created = createMapEventAt(project.game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    created.pages[0].contents = structuredClone(initialContents);
    if (withSprite) created.pages[0].sprite = { image: 'sprites/test.png', characterIndex: 0, characterColumns: 4, frameWidth: 48, frameHeight: 48, objectAligned: false };
    return created;
  });
  project.game.maps['map-1'].events = [event];
  const createSwitch = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'switch';
    let id = base;
    let suffix = 2;
    while (switches[id]) id = `${base}-${suffix++}`;
    setSwitches(current => ({ ...current, [id]: { name, initialValue: false } }));
    return id;
  };
  const createVariable = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'variable';
    let id = base;
    let suffix = 2;
    while (variables[id]) id = `${base}-${suffix++}`;
    setVariables(current => ({ ...current, [id]: { name, initialValue: 0 } }));
    return id;
  };
  const changeEvent = (nextEvent: MapEvent) => {
    setEvent(nextEvent);
    onEventChange?.(nextEvent);
  };
  const renameSwitch = (id: string, name: string) => setSwitches(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  const renameVariable = (id: string, name: string) => setVariables(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  const renameItem = (id: string, name: string) => setItems(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  return <TooltipProvider delay={0}><EventInspector game={project.game} mapId="map-1" event={event} issues={[]} assetUrls={{}} sprites={[]} onChangeEvent={changeEvent} onImportSprite={async () => {}} onCreateSwitch={createSwitch} onCreateVariable={createVariable} onRenameSwitch={renameSwitch} onRenameVariable={renameVariable} onRenameItem={renameItem} /></TooltipProvider>;
}

describe('EventInspector pages', () => {
  it('uses the sidebar theme colors', () => {
    const { container } = render(<Harness />);

    expect(container.querySelector('[data-slot="event-inspector"]')).toHaveClass('bg-sidebar', 'text-sidebar-foreground');
  });

  it('omits the top border from the first section header', () => {
    const { container } = render(<Harness />);

    const conditionsHeader = screen.getByText('Conditions').closest('[data-slot="section-header"]');
    expect(conditionsHeader).toHaveClass('border-t-0');
    expect(conditionsHeader?.parentElement?.children).toHaveLength(1);
    expect(screen.getByText('Autonomous Movement').closest('[data-slot="section-header"]')).not.toHaveClass('border-t-0');
    expect([...container.querySelectorAll('[data-slot="section-header"]')].map(header => header.textContent)).toEqual([
      'Conditions', 'Trigger', 'Contents', 'Sprite', 'Autonomous Movement',
    ]);
    expect(screen.queryByRole('checkbox', { name: 'Walking animation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
  });

  it('shows sprite options inside the Sprite section only when a sprite is selected', () => {
    render(<Harness withSprite />);

    const spriteSection = screen.getByText('Sprite').closest('section');
    expect(spriteSection?.querySelector('[data-slot="attachment"]')).toBeInTheDocument();
    expect(spriteSection).toContainElement(screen.getByRole('button', { name: 'Change sprite' }));
    expect(spriteSection).toContainElement(screen.getByRole('button', { name: 'Remove sprite' }));
    expect(spriteSection).toContainElement(screen.getByRole('checkbox', { name: 'Walking animation' }));
    expect(spriteSection).toContainElement(screen.getByRole('checkbox', { name: 'Through' }));
    expect(spriteSection).toHaveTextContent('Priority');
    expect(screen.queryByRole('combobox', { name: 'Priority' })).not.toBeInTheDocument();
    expect(screen.getByText('Priority').tagName).toBe('LABEL');
    expect(screen.getByText('Priority')).toHaveClass('text-[10px]', 'font-medium', 'text-muted-foreground');
    expect(screen.getByText('Priority').parentElement).toHaveClass('gap-1.5');
    expect(screen.getByText('Priority').parentElement?.parentElement).toHaveClass('grid-cols-2');
    expect(screen.getByRole('tablist', { name: 'Priority' })).toHaveClass('w-full');
    expect(screen.getByRole('tab', { name: 'Same as characters' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Walking animation' }).closest('.grid')).toHaveClass('grid-cols-2');
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
  });

  it('selects sprite priority from icon tabs', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness withSprite onEventChange={onEventChange} />);

    await user.click(screen.getByRole('tab', { name: 'Above characters' }));

    expect(screen.getByRole('tab', { name: 'Above characters' })).toHaveAttribute('aria-selected', 'true');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].priority).toBe('aboveCharacters');
  });

  it('opens sprite selection as a contextual popover', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose a sprite' }));
    const picker = screen.getByRole('dialog');
    expect(picker).toHaveClass('w-72', 'rounded-lg', 'bg-popover', 'text-popover-foreground');
    expect(screen.getByRole('searchbox', { name: 'Search event sprites' })).toBeInTheDocument();
    expect(screen.getByText('Sprites').closest('[data-slot="section-header"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close sprite picker' }));
    expect(screen.queryByRole('searchbox', { name: 'Search event sprites' })).not.toBeInTheDocument();
  });

  it('selects the trigger type from icon tabs', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    expect(screen.queryByRole('combobox', { name: 'Trigger type' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Type' })).toHaveClass('w-full');
    expect(screen.getByText('Type').tagName).toBe('LABEL');
    expect(screen.getByText('Type')).toHaveClass('text-[10px]', 'font-medium', 'text-muted-foreground');
    expect(screen.getByText('Type').parentElement).toHaveClass('gap-1.5');
    const actionButton = screen.getByRole('tab', { name: 'Action Button' });
    expect(actionButton).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Player Touch' }));

    expect(screen.getByRole('tab', { name: 'Player Touch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toBeInTheDocument();
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].trigger).toEqual({ type: 'playerTouch', size: { w: 1, h: 1 } });
  });

  it('configures autonomous movement in a contextual settings panel', async () => {
    const user = userEvent.setup();
    render(<Harness withSprite />);

    const enabled = screen.getByRole('switch', { name: 'Enable autonomous movement' });
    expect(enabled).not.toBeChecked();
    expect(screen.queryByRole('combobox', { name: 'Autonomous movement type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Autonomous movement settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Movement speed' })).not.toBeInTheDocument();

    await user.click(enabled);
    expect(enabled).toBeChecked();
    const type = screen.getByRole('combobox', { name: 'Autonomous movement type' });
    expect(type).toHaveTextContent('Random');
    expect(type.parentElement).not.toHaveTextContent(/^Type/);
    await user.click(screen.getByRole('button', { name: 'Autonomous movement settings' }));
    const settings = await screen.findByRole('dialog');
    expect(settings).toHaveTextContent('Speed · 3');
    expect(settings).toHaveTextContent('Frequency · 3');
    await user.click(screen.getByRole('button', { name: 'Close autonomous movement settings' }));

    await user.click(type);
    await user.click(await screen.findByRole('option', { name: 'Custom route' }));
    await user.click(screen.getByRole('button', { name: 'Autonomous movement settings' }));
    const routeHeader = (await screen.findByText('Looping route')).closest('[data-slot="section-header"]');
    expect(routeHeader).toHaveClass('border-t');
    expect(routeHeader).not.toHaveClass('border-b');
    await user.click(screen.getByRole('button', { name: 'Add movement command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const moveDirection = screen.getByRole('combobox', { name: 'Move direction' });
    expect(moveDirection).toHaveTextContent('Moveforward');
    await user.click(screen.getByRole('button', { name: 'Remove move command' }));
    expect(screen.queryByRole('combobox', { name: 'Move direction' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close autonomous movement settings' }));
    await user.click(enabled);
    expect(screen.queryByRole('combobox', { name: 'Autonomous movement type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Autonomous movement settings' })).not.toBeInTheDocument();
  });

  it('adds a selected condition type from the section header and removes it inline', async () => {
    render(<Harness />);

    const addCondition = screen.getByRole('button', { name: 'Add condition' });
    expect(screen.getByText('Conditions').closest('[data-slot="section-header"]')).toContainElement(addCondition);
    expect(addCondition.closest('[data-slot="section-header-actions"]')).toHaveClass('gap-0.5');
    expect(addCondition).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();

    addCondition.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('menuitem', { name: 'Quest' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    const conditionToggle = screen.getByRole('button', { name: 'Event condition' });
    expect(conditionToggle).toHaveAttribute('data-slot', 'toggle');
    expect(conditionToggle).toHaveTextContent('SwitchDoor open = On');
    expect(conditionToggle.querySelector('.lucide-toggle-left')).toBeInTheDocument();
    expect(conditionToggle.querySelector('.lucide-git-branch')).not.toBeInTheDocument();
    expect(conditionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Remove switch condition' })).toHaveAttribute('data-base-ui-tooltip-trigger');

    await userEvent.click(screen.getByRole('button', { name: 'Remove switch condition' }));
    expect(screen.queryByRole('button', { name: 'Event condition' })).not.toBeInTheDocument();

    await userEvent.click(addCondition);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Item' }));
    expect(screen.getByRole('button', { name: 'Event condition' })).toHaveTextContent('ItemPotion ×1');
  });

  it('searches and selects items from the condition picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Item' }));
    const conditionToggle = screen.getByRole('button', { name: 'Event condition' });
    expect(conditionToggle).toHaveTextContent('ItemPotion ×1');
    expect(conditionToggle.querySelector('.lucide-package')).toBeInTheDocument();

    await user.click(conditionToggle);
    const dialog = screen.getByRole('dialog');
    const itemPicker = within(dialog).getByRole('button', { name: 'Choose item' });
    await user.click(itemPicker);
    const search = await screen.findByRole('textbox', { name: 'Search items' });
    expect(screen.getByText('Items').closest('[data-slot="section-header"]')).toHaveClass('h-12', 'px-4', 'py-4');
    expect(screen.getByRole('option', { name: 'Potion' })).toHaveClass('bg-primary/15');
    expect(screen.getByRole('option', { name: 'Silver Sword' })).toBeInTheDocument();

    await user.type(search, 'silver');
    expect(screen.queryByRole('option', { name: 'Potion' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Silver Sword' }));
    expect(conditionToggle).toHaveTextContent('Silver Sword ×1');
  });

  it('searches, selects and creates switches from the condition picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    const conditionDialog = await screen.findByRole('dialog');
    const switchPicker = within(conditionDialog).getByRole('button', { name: 'Choose switch' });
    expect(switchPicker).toHaveTextContent('Door open');
    expect(switchPicker).not.toHaveTextContent('On');
    expect(switchPicker).toHaveAttribute('data-slot', 'toggle');
    expect(switchPicker).toHaveClass('hover:bg-muted');
    expect(switchPicker).toHaveAttribute('aria-pressed', 'false');
    const conditionDialogRect = vi.spyOn(conditionDialog, 'getBoundingClientRect').mockReturnValue({ x: 300, y: 50, left: 300, top: 50, right: 620, bottom: 500, width: 320, height: 450, toJSON: () => ({}) });
    await user.click(switchPicker);
    const search = await screen.findByRole('textbox', { name: 'Search switches' });
    expect(switchPicker).toHaveAttribute('aria-pressed', 'true');
    expect(conditionDialogRect).toHaveBeenCalled();
    const picker = screen.getAllByRole('dialog').at(-1)!;
    expect(screen.getByText('Switches').closest('[data-slot="section-header"]')).toHaveClass('h-12', 'px-4', 'py-4');
    const selectedOption = screen.getByRole('option', { name: 'Door open' });
    expect(picker).toHaveClass('rounded-lg', 'bg-popover', 'text-popover-foreground');
    expect(picker).not.toHaveClass('p-2');
    expect(selectedOption).toHaveClass('bg-primary/15');
    expect(selectedOption.closest('[data-slot="scroll-area"]')).toHaveClass('max-h-56');
    expect(screen.queryByText('door-open')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create switch' })).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.getByRole('button', { name: 'Close switch picker' })).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.getByRole('button', { name: 'Create switch' }).closest('[data-slot="section-header-actions"]')).toHaveClass('gap-0.5');
    expect(screen.getByRole('option', { name: 'Boss defeated' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close switch picker' }));
    expect(screen.queryByRole('textbox', { name: 'Search switches' })).not.toBeInTheDocument();
    await user.click(switchPicker);

    await user.type(screen.getByRole('textbox', { name: 'Search switches' }), 'boss');
    expect(screen.queryByRole('option', { name: 'Door open' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Boss defeated' }));
    expect(switchPicker).toHaveTextContent('Boss defeated');

    await user.click(switchPicker);
    await user.click(screen.getByRole('button', { name: 'Create switch' }));
    await user.type(await screen.findByRole('textbox', { name: 'Switch name' }), 'Treasure claimed');
    await user.click(screen.getByRole('button', { name: 'Confirm switch creation' }));

    expect(switchPicker).toHaveTextContent('Treasure claimed');
    await user.click(switchPicker);
    expect(await screen.findByRole('option', { name: 'Treasure claimed' })).toBeInTheDocument();
  });

  it('configures a switch condition with the shared condition form', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));
    const conditionToggle = screen.getByRole('button', { name: 'Event condition' });
    expect(conditionToggle).toHaveTextContent('SwitchDoor open = On');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Condition').closest('[data-slot="section-header"]')).toHaveClass('h-12', 'px-4', 'py-4');
    expect(dialog).toHaveClass('rounded-lg', 'bg-popover', 'text-popover-foreground');
    expect(screen.getByRole('button', { name: 'Close condition settings' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Condition type' })).toHaveTextContent('Switch');
    const expectedValue = await screen.findByLabelText('Fixed switch value');
    expect(expectedValue).toBeChecked();
    await user.click(expectedValue);
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'switch', operand: { kind: 'constant', value: false } });
    expect(conditionToggle).toHaveTextContent('Door open = Off');
    await user.click(screen.getByRole('combobox', { name: 'Condition type' }));
    await user.click(await screen.findByRole('option', { name: 'Variable' }));
    expect(conditionToggle).toHaveTextContent('VariableScore = 0');
    expect(conditionToggle.querySelector('.lucide-hash')).toBeInTheDocument();
    expect(conditionToggle.querySelector('.lucide-toggle-left')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close condition settings' }));
  });

  it('configures an item condition with the shared condition form', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Item' }));
    const conditionToggle = screen.getByRole('button', { name: 'Event condition' });
    expect(conditionToggle).toHaveTextContent('ItemPotion ×1');
    expect(conditionToggle.querySelector('.lucide-package')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Required quantity' })).not.toBeInTheDocument();

    await user.click(conditionToggle);
    const quantity = await screen.findByRole('spinbutton', { name: 'Required quantity' });
    await user.clear(quantity);
    await user.type(quantity, '3');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'item', amount: 3 });
    expect(conditionToggle).toHaveTextContent('×3');
  });

  it('searches and configures a variable condition with the shared condition form', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Variable' }));
    const conditionToggle = screen.getByRole('button', { name: 'Event condition' });
    expect(conditionToggle).toHaveTextContent('VariableScore = 0');
    expect(conditionToggle.querySelector('.lucide-hash')).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    const variablePicker = within(dialog).getByRole('button', { name: 'Choose variable' });
    expect(variablePicker).toHaveTextContent('Score');
    expect(variablePicker).not.toHaveTextContent('= 0');
    expect(variablePicker).toHaveAttribute('data-slot', 'toggle');
    expect(variablePicker).toHaveClass('hover:bg-muted');
    await user.click(variablePicker);
    await user.type(screen.getByRole('textbox', { name: 'Search variables' }), 'reputation');
    await user.click(screen.getByRole('option', { name: 'Reputation' }));

    expect(conditionToggle).toHaveTextContent('Reputation = 0');

    const comparisonTabs = await screen.findByRole('tablist', { name: 'Variable comparison' });
    await user.click(within(comparisonTabs).getByRole('tab', { name: 'Greater than or equal' }));
    const comparisonValue = screen.getByRole('spinbutton', { name: 'Value' });
    await user.clear(comparisonValue);
    await user.type(comparisonValue, '12');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'variable', id: 'reputation', operator: 'greaterThanOrEqual', operand: { kind: 'constant', value: 12 } });
    expect(conditionToggle).toHaveTextContent('Reputation ≥ 12');
    await user.click(screen.getByRole('combobox', { name: 'Variable operand type' }));
    expect(screen.queryByRole('option', { name: 'Random range' })).not.toBeInTheDocument();
  });

  it('configures structured operands for event conditions', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));
    const switchDialog = await screen.findByRole('dialog');
    await user.click(within(switchDialog).getByRole('combobox', { name: 'Switch operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Switch' }));
    await user.click(within(switchDialog).getAllByRole('button', { name: 'Choose switch' })[1]);
    await user.click(await screen.findByRole('option', { name: 'Boss defeated' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toEqual({ kind: 'switch', id: 'door-open', operand: { kind: 'switch', switchId: 'boss-defeated' } });
    await user.click(within(switchDialog).getByRole('combobox', { name: 'Switch operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Game data' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toEqual({ kind: 'switch', id: 'door-open', operand: { kind: 'gameData', data: { kind: 'hasItem', itemId: 'potion' } } });
    await user.click(within(switchDialog).getByRole('button', { name: 'Close condition settings' }));

    await user.click(screen.getByRole('button', { name: 'Remove switch condition' }));
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Variable' }));
    const variableDialog = await screen.findByRole('dialog');
    await user.click(within(variableDialog).getByRole('combobox', { name: 'Variable operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Variable' }));
    await user.click(within(variableDialog).getAllByRole('button', { name: 'Choose variable' })[1]);
    await user.click(await screen.findByRole('option', { name: 'Reputation' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toEqual({ kind: 'variable', id: 'score', operator: 'equal', operand: { kind: 'variable', variableId: 'reputation' } });
    await user.click(within(variableDialog).getByRole('combobox', { name: 'Variable operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Game data' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toEqual({ kind: 'variable', id: 'score', operator: 'equal', operand: { kind: 'gameData', data: { kind: 'itemAmount', itemId: 'potion' } } });
  });

  it('keeps a switch condition as a draft until its first switch is created', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness emptySwitches onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Choose switch' }));
    expect(await screen.findByText('No switches found.')).toBeInTheDocument();
    expect(onEventChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Create switch' }));
    await user.type(await screen.findByRole('textbox', { name: 'Switch name' }), 'First switch');
    await user.click(screen.getByRole('button', { name: 'Confirm switch creation' }));

    expect(onEventChange).toHaveBeenCalledTimes(1);
    const persistedCondition = onEventChange.mock.calls[0][0].pages[0].conditions?.[0];
    expect(persistedCondition).toMatchObject({ kind: 'switch', id: 'first-switch', operand: { kind: 'constant', value: true } });
  });

  it('adds and configures a set-variable command without offering set quest state', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    const addCommand = screen.getByRole('button', { name: 'Add command' });
    expect(screen.getByText('Contents').closest('[data-slot="section-header"]')).toContainElement(addCommand);
    await user.click(addCommand);
    expect(screen.queryByRole('menuitem', { name: /set quest state/i })).not.toBeInTheDocument();
    const setVariableItem = await screen.findByRole('menuitem', { name: 'Set variable' });
    expect(setVariableItem.querySelector('.lucide-hash')).toBeInTheDocument();
    await user.click(setVariableItem);

    const commandSettings = screen.getByRole('button', { name: 'Set variable command settings' });
    const commandRow = commandSettings.parentElement;
    expect(commandRow).toHaveClass('items-center');
    expect(commandSettings).toHaveClass('border', 'border-input');
    expect(commandSettings).toHaveClass('h-7');
    expect(commandSettings).toHaveAttribute('data-slot', 'toggle');
    const setVariableIcon = commandSettings.querySelector('.lucide-hash')!;
    expect(setVariableIcon).toBeInTheDocument();
    expect(setVariableIcon.parentElement).toHaveClass('text-muted-foreground', '[&_svg]:size-3.5');
    expect(commandSettings.querySelector('.truncate')).toHaveClass('text-right', 'text-muted-foreground');
    expect(commandSettings).toHaveTextContent('Variable');
    expect(commandSettings).not.toHaveTextContent('Set variable');
    expect(commandSettings).toHaveAttribute('aria-pressed', 'true');
    expect(commandSettings).toHaveAttribute('aria-expanded', 'true');
    expect(commandRow).toHaveTextContent('Score = 0');
    expect(within(commandRow!).queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(within(commandRow!).queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();
    expect(within(commandRow!).getByRole('button', { name: 'Remove setVariable command' }).querySelector('.lucide-minus')).toBeInTheDocument();
    expect(commandRow?.querySelector('.lucide-settings-2')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Command type' })).not.toBeInTheDocument();
    const commandDialog = await screen.findByRole('dialog');
    expect(commandDialog).toHaveTextContent('Set variable');
    expect(within(commandDialog).queryByRole('combobox', { name: 'Command type' })).not.toBeInTheDocument();

    const variable = within(commandDialog).getByRole('button', { name: 'Choose variable' });
    expect(variable).toHaveTextContent('Score');
    await user.click(variable);
    await user.click(await screen.findByRole('option', { name: 'Reputation' }));
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    await user.clear(value);
    await user.type(value, '25');

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setVariable', id: 'reputation', operation: 'set', operand: { kind: 'constant', value: 25 } });
  });

  it('opens the variable picker when a set-variable command has nothing to select', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness emptyVariables onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set variable' }));

    expect(screen.getByRole('button', { name: 'Set variable command settings' })).toHaveTextContent('Choose a variable = 0');
    expect(screen.getByRole('button', { name: 'Choose variable' })).toHaveTextContent('Choose a variable');
    expect(await screen.findByRole('textbox', { name: 'Search variables' })).toBeInTheDocument();
    expect(screen.getByText('No variables found.')).toBeInTheDocument();
    expect(onEventChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create variable' }));
    await user.type(await screen.findByRole('textbox', { name: 'Variable name' }), 'Quest progress');
    await user.click(screen.getByRole('button', { name: 'Confirm variable creation' }));

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setVariable', id: 'quest-progress', operation: 'set', operand: { kind: 'constant', value: 0 } });
    expect(screen.getByRole('button', { name: 'Choose variable' })).toHaveTextContent('Quest progress');
  });

  it('configures arithmetic, random, and coordinate operands for variables', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set variable' }));
    expect(screen.queryByRole('combobox', { name: 'Variable operation' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Variable operation' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Add' }));
    expect(screen.getByRole('tab', { name: 'Add' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('combobox', { name: 'Variable operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Random range' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Minimum' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Minimum' }), '2.5');
    await user.clear(screen.getByRole('spinbutton', { name: 'Maximum' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum' }), '8');

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setVariable', id: 'score', operation: 'add', operand: { kind: 'random', min: 2.5, max: 8 } });

    await user.click(screen.getByRole('combobox', { name: 'Variable operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Game data' }));
    await user.click(screen.getByRole('combobox', { name: 'Variable game data' }));
    await user.click(await screen.findByRole('option', { name: 'Character coordinate' }));
    await user.click(screen.getByRole('combobox', { name: 'Coordinate character' }));
    await user.click(await screen.findByRole('option', { name: 'This event' }));
    await user.click(screen.getByRole('combobox', { name: 'Coordinate axis' }));
    await user.click(await screen.findByRole('option', { name: 'Y' }));

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setVariable', id: 'score', operation: 'add', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'thisEvent' }, axis: 'y' } } });
  });

  it('opens the switch picker when a set-switch command has nothing to select', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness emptySwitches onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set switch' }));

    expect(screen.getByRole('button', { name: 'Set switch command settings' })).toHaveTextContent('Choose a switch · On');
    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('Choose a switch');
    expect(await screen.findByRole('textbox', { name: 'Search switches' })).toBeInTheDocument();
    expect(screen.getByText('No switches found.')).toBeInTheDocument();
    expect(onEventChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create switch' }));
    await user.type(await screen.findByRole('textbox', { name: 'Switch name' }), 'Bridge open');
    await user.click(screen.getByRole('button', { name: 'Confirm switch creation' }));

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setSwitch', id: 'bridge-open', operation: 'set', operand: { kind: 'constant', value: true } });
    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('Bridge open');
  });

  it('toggles a switch without displaying an operand', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set switch' }));
    expect(screen.queryByRole('combobox', { name: 'Switch operation' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Switch operation' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Toggle' }));
    expect(screen.getByRole('tab', { name: 'Toggle' })).toHaveAttribute('aria-selected', 'true');

    expect(screen.queryByRole('combobox', { name: 'Switch operand type' })).not.toBeInTheDocument();
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setSwitch', id: 'door-open', operation: 'toggle' });
    expect(screen.getByRole('button', { name: 'Set switch command settings' })).toHaveTextContent('ToggleDoor open');
  });

  it('configures switch and boolean game-data operands', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set switch' }));
    await user.click(screen.getByRole('combobox', { name: 'Switch operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Switch' }));
    await user.click(screen.getAllByRole('button', { name: 'Choose switch' })[1]);
    await user.click(await screen.findByRole('option', { name: 'Boss defeated' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setSwitch', id: 'door-open', operation: 'set', operand: { kind: 'switch', switchId: 'boss-defeated' } });

    await user.click(screen.getByRole('combobox', { name: 'Switch operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Game data' }));
    await user.click(screen.getByRole('combobox', { name: 'Switch game data' }));
    await user.click(await screen.findByRole('option', { name: 'Item equipped' }));
    expect(screen.getByRole('combobox', { name: 'Game data item' })).toHaveTextContent('Silver Sword');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setSwitch', id: 'door-open', operation: 'set', operand: { kind: 'gameData', data: { kind: 'itemEquipped', itemId: 'silver-sword' } } });
  });

  it('automatically opens a command added to a dialogue choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dialogue' }));
    const dialogueDialog = await screen.findByRole('dialog');
    await user.click(within(dialogueDialog).getByRole('button', { name: 'Add choice' }));
    await user.click(within(dialogueDialog).getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Toast' }));

    expect(screen.getByRole('button', { name: 'Toast command settings' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('dialog').at(-1)).toHaveTextContent('Toast');
  });

  it('shows concise command names with only their primary configured value', () => {
    const commands: EventCommand[] = [
      { type: 'dialogue', speaker: 'Guide', text: 'A very long dialogue that should stay hidden', choices: [] },
      { type: 'setSwitch', id: 'door-open', operation: 'set', operand: { kind: 'constant', value: true } },
      { type: 'setVariable', id: 'score', operation: 'set', operand: { kind: 'constant', value: 12 } },
      { type: 'giveItem', id: 'potion', amount: 2 },
      { type: 'removeItem', id: 'silver-sword', amount: 1 },
      { type: 'unlockSkill', id: 'dash' },
      { type: 'healPlayer', amount: 25 },
      { type: 'toast', text: 'Quest updated' },
      { type: 'movementRoute', target: { kind: 'player' }, route: { commands: [], repeat: false, skippable: false, wait: true } },
      { type: 'wait', duration: 0.5 },
      { type: 'teleport', destination: { map: { kind: 'constant', mapId: 'map-1' }, x: { kind: 'constant', value: 8 }, y: { kind: 'constant', value: 4 } }, direction: 'east', transition: 'fadeWhite' },
      { type: 'save' },
    ];
    render(<Harness initialContents={commands} />);

    expect(screen.getByRole('button', { name: 'Dialogue command settings' })).toHaveTextContent('DialogueGuide');
    expect(screen.getByRole('button', { name: 'Dialogue command settings' })).not.toHaveTextContent('A very long dialogue');
    expect(screen.getByRole('button', { name: 'Set switch command settings' })).toHaveTextContent('SetDoor open · On');
    expect(screen.getByRole('button', { name: 'Set variable command settings' })).toHaveTextContent('VariableScore = 12');
    expect(screen.getByRole('button', { name: 'Give item command settings' })).toHaveTextContent('GivePotion ×2');
    expect(screen.getByRole('button', { name: 'Remove item command settings' })).toHaveTextContent('RemoveSilver Sword ×1');
    expect(screen.getByRole('button', { name: 'Unlock skill command settings' })).toHaveTextContent('Unlockdash');
    expect(screen.getByRole('button', { name: 'Heal player command settings' })).toHaveTextContent('Heal25 HP');
    expect(screen.getByRole('button', { name: 'Toast command settings' })).toHaveTextContent('ToastQuest updated');
    expect(screen.getByRole('button', { name: 'Movement route command settings' })).toHaveTextContent('MovePlayer');
    expect(screen.getByRole('button', { name: 'Wait command settings' })).toHaveTextContent('Wait0.5s');
    expect(screen.getByRole('button', { name: 'Teleport command settings' })).toHaveTextContent('TeleportMap 1');
    expect(screen.getByRole('button', { name: 'Teleport command settings' })).not.toHaveTextContent('8');
    expect(screen.getByRole('button', { name: 'Save command settings' })).toHaveTextContent('Save');
  });

  it('reorders commands from their handles with drag and drop or the keyboard', () => {
    const onEventChange = vi.fn();
    render(<Harness initialContents={[
      { type: 'toast', text: 'First' },
      { type: 'wait', duration: 1 },
      { type: 'save' },
    ]} onEventChange={onEventChange} />);

    const toastHandle = screen.getByRole('button', { name: 'Reorder Toast command' });
    expect(toastHandle.querySelector('.lucide-grip-vertical')).toBeInTheDocument();
    expect(toastHandle).not.toHaveAttribute('data-base-ui-tooltip-trigger');
    fireEvent.keyDown(toastHandle, { key: 'ArrowDown', altKey: true });
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents.map((command: EventCommand) => command.type)).toEqual(['wait', 'toast', 'save']);

    const saveHandle = screen.getByRole('button', { name: 'Reorder Save command' });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() };
    fireEvent.dragStart(saveHandle, { dataTransfer });
    const unchangedLastPosition = document.querySelector<HTMLElement>('[data-command-drop-position="3"]')!;
    fireEvent.dragOver(unchangedLastPosition, { dataTransfer });
    expect(unchangedLastPosition.querySelector('.bg-primary')).not.toBeInTheDocument();
    const firstPosition = document.querySelector<HTMLElement>('[data-command-drop-position="0"]')!;
    fireEvent.dragOver(firstPosition, { dataTransfer });
    expect(firstPosition.querySelector('.bg-primary')).toBeInTheDocument();
    fireEvent.drop(firstPosition, { dataTransfer });
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents.map((command: EventCommand) => command.type)).toEqual(['save', 'wait', 'toast']);
  });

  it('configures teleport sources, direction, and transition without plane settings', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    const teleport: EventCommand = {
      type: 'teleport',
      destination: { map: { kind: 'constant', mapId: 'map-1' }, x: { kind: 'constant', value: 2 }, y: { kind: 'constant', value: 3 } },
      direction: 'retain',
      transition: 'instant',
    };
    render(<Harness initialContents={[teleport]} onEventChange={onEventChange} />);

    const settings = screen.getByRole('button', { name: 'Teleport command settings' });
    expect(settings).toHaveTextContent('TeleportMap 1');
    expect(settings).not.toHaveTextContent('X 2');
    expect(settings).not.toHaveTextContent('Keep direction');
    await user.click(settings);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Reset map state')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Map source' }).parentElement).toHaveClass('grid-cols-2');
    expect(within(dialog).getByRole('combobox', { name: 'X source' }).parentElement).toHaveClass('grid-cols-2');
    expect(within(dialog).getByRole('combobox', { name: 'Y source' }).parentElement).toHaveClass('grid-cols-2');
    expect(within(dialog).getByRole('combobox', { name: 'Player direction' }).closest('label')?.parentElement).toHaveClass('grid-cols-2');
    expect(within(dialog).getByRole('combobox', { name: 'Destination map' })).toHaveTextContent('#1 · Map 1');
    expect(within(dialog).getByRole('spinbutton', { name: 'X coordinate' })).toHaveValue(2);
    expect(within(dialog).getByRole('spinbutton', { name: 'Y coordinate' })).toHaveValue(3);
    expect(within(dialog).getByRole('spinbutton', { name: 'X coordinate' })).toHaveAttribute('step', '1');
    expect(within(dialog).getByRole('spinbutton', { name: 'Y coordinate' })).toHaveAttribute('step', '1');

    await user.click(within(dialog).getByRole('combobox', { name: 'Map source' }));
    await user.click(await screen.findByRole('option', { name: 'Variable' }));
    expect(within(dialog).getByRole('combobox', { name: 'Map variable' })).toHaveTextContent('Score');
    await user.click(within(dialog).getByRole('combobox', { name: 'X source' }));
    await user.click(await screen.findByRole('option', { name: 'Variable' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'X variable' }));
    await user.click(await screen.findByRole('option', { name: 'Reputation' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Player direction' }));
    await user.click(await screen.findByRole('option', { name: 'East' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Teleport transition' }));
    await user.click(await screen.findByRole('option', { name: 'Fade to black' }));

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({
      type: 'teleport',
      destination: { map: { kind: 'variable', variableId: 'score' }, x: { kind: 'variable', variableId: 'reputation' }, y: { kind: 'constant', value: 3 } },
      direction: 'east',
      transition: 'fadeBlack',
    });
  });

  it('adds and edits a conditional branch with an optional else', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    const flowGroup = (await screen.findByText('Flow & state')).closest<HTMLElement>('[data-slot="dropdown-menu-group"]')!;
    expect(flowGroup.closest('[data-slot="dropdown-menu-content"]')).toHaveClass('w-64');
    expect(within(flowGroup).getByRole('menuitem', { name: 'Conditional branch' })).toBeInTheDocument();
    expect(within(flowGroup).getByRole('menuitem', { name: 'Set switch' })).toBeInTheDocument();
    expect(screen.getByText('Dialogue & feedback')).toBeInTheDocument();
    expect(screen.getByText('Player & inventory')).toBeInTheDocument();
    expect(screen.getByText('Movement & world')).toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Conditional branch' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({
      type: 'conditional',
      condition: { kind: 'switch', id: 'door-open', operand: { kind: 'constant', value: true } },
      thenCommands: [],
    });
    const conditionalSettings = screen.getByRole('button', { name: 'Conditional branch command settings' });
    const conditionalCommandIcon = conditionalSettings.querySelector('.lucide-git-branch')!;
    expect(conditionalCommandIcon).toBeInTheDocument();
    expect(conditionalCommandIcon.parentElement).toHaveClass('text-muted-foreground', '[&_svg]:size-3.5');
    expect(conditionalSettings.querySelector('.lucide-toggle-left')).not.toBeInTheDocument();
    expect(conditionalSettings.querySelector('.truncate')).toHaveClass('text-right', 'text-muted-foreground');
    expect(conditionalSettings).toHaveTextContent('If');
    expect(conditionalSettings).toHaveTextContent('Door open = On');
    expect(conditionalSettings).not.toHaveTextContent('·');

    const conditionType = await screen.findByRole('combobox', { name: 'Condition type' });
    const dialog = screen.getByRole('dialog');
    const triggerTypeLabel = screen.getByText('Type', { selector: 'label' });
    const conditionTypeLabel = within(dialog).getByText('Condition type', { selector: 'span' });
    expect(conditionTypeLabel.className).toBe(triggerTypeLabel.className);
    expect(conditionTypeLabel).toHaveClass('text-[10px]', 'font-medium', 'text-muted-foreground');
    expect(within(dialog).queryByText('Then')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Else')).not.toBeInTheDocument();
    expect(conditionType.querySelector('.lucide-toggle-left')).toBeInTheDocument();
    const switchPicker = within(dialog).getByRole('button', { name: 'Choose switch' });
    expect(switchPicker).toHaveTextContent('Door open');
    expect(switchPicker.querySelector('.lucide-toggle-left')).not.toBeInTheDocument();
    const expectedSwitchValue = within(dialog).getByRole('checkbox', { name: /^Fixed switch value/ });
    expect(expectedSwitchValue).toBeChecked();
    await user.click(expectedSwitchValue);
    expect(conditionalSettings).toHaveTextContent('Door open = Off');
    await user.click(expectedSwitchValue);
    expect(conditionalSettings).toHaveTextContent('Door open = On');
    expect(within(dialog).queryByRole('button', { name: 'Switch condition settings' })).not.toBeInTheDocument();
    await user.click(switchPicker);
    const searchSwitches = await screen.findByRole('textbox', { name: 'Search switches' });
    await user.type(searchSwitches, 'boss');
    expect(screen.queryByRole('option', { name: 'Door open' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Boss defeated' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].condition.id).toBe('boss-defeated');
    const elseBranch = within(dialog).getByRole('checkbox', { name: 'Else branch' });
    expect(elseBranch).not.toBeChecked();
    await user.click(conditionType);
    await user.click(await screen.findByRole('option', { name: 'Variable' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].condition).toEqual({ kind: 'variable', id: 'score', operator: 'equal', operand: { kind: 'constant', value: 0 } });
    expect(conditionalSettings.querySelector('.lucide-hash')).not.toBeInTheDocument();
    expect(conditionalSettings).toHaveTextContent('Score = 0');
    expect(conditionalSettings).not.toHaveTextContent('·');
    expect(conditionType.querySelector('.lucide-hash')).toBeInTheDocument();
    const variablePicker = within(dialog).getByRole('button', { name: 'Choose variable' });
    expect(variablePicker).toHaveTextContent('Score');
    expect(variablePicker.querySelector('.lucide-hash')).not.toBeInTheDocument();
    const comparisonTabs = within(dialog).getByRole('tablist', { name: 'Variable comparison' });
    expect(within(comparisonTabs).getByRole('tab', { name: 'Equal' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('spinbutton', { name: 'Value' })).toHaveValue(0);
    expect(within(dialog).queryByRole('button', { name: 'Variable condition settings' })).not.toBeInTheDocument();
    await user.click(variablePicker);
    const searchVariables = await screen.findByRole('textbox', { name: 'Search variables' });
    await user.type(searchVariables, 'repu');
    expect(screen.queryByRole('option', { name: 'Score' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Reputation' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].condition.id).toBe('reputation');
    expect(conditionalSettings).toHaveTextContent('Reputation = 0');
    await user.click(within(dialog).getByRole('combobox', { name: 'Variable operand type' }));
    await user.click(await screen.findByRole('option', { name: 'Game data' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Variable game data' }));
    await user.click(await screen.findByRole('option', { name: 'Character coordinate' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Coordinate character' }));
    await user.click(await screen.findByRole('option', { name: 'This event' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Coordinate axis' }));
    await user.click(await screen.findByRole('option', { name: 'Y' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].condition).toEqual({ kind: 'variable', id: 'reputation', operator: 'equal', operand: { kind: 'gameData', data: { kind: 'characterCoordinate', target: { kind: 'thisEvent' }, axis: 'y' } } });
    expect(conditionalSettings).toHaveTextContent('Reputation = This event Y');
    await user.click(conditionType);
    await user.click(await screen.findByRole('option', { name: 'Item' }));
    expect(conditionType.querySelector('.lucide-package')).toBeInTheDocument();
    const itemPicker = within(dialog).getByRole('button', { name: 'Choose item' });
    expect(itemPicker).toHaveTextContent('Potion');
    expect(itemPicker.querySelector('.lucide-package')).not.toBeInTheDocument();
    await user.click(itemPicker);
    const searchItems = await screen.findByRole('textbox', { name: 'Search items' });
    await user.type(searchItems, 'silver');
    expect(screen.queryByRole('option', { name: 'Potion' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Silver Sword' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].condition).toEqual({ kind: 'item', id: 'silver-sword', amount: 1 });
    expect(conditionalSettings).toHaveTextContent('Silver Sword ×1');

    await user.click(elseBranch);
    expect(elseBranch).toBeChecked();
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].elseCommands).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Close command settings' }));
    const thenHeader = screen.getByText('Then').closest<HTMLElement>('[data-slot="conditional-branch-header"]')!;
    const elseHeader = screen.getByText('Else').closest<HTMLElement>('[data-slot="conditional-branch-header"]')!;
    expect(thenHeader).toHaveClass('text-xs', 'font-normal');
    expect(elseHeader).toHaveClass('text-xs', 'font-normal');
    expect(thenHeader).not.toHaveAttribute('data-slot', 'section-header');
    expect(elseHeader).not.toHaveAttribute('data-slot', 'section-header');
    expect(thenHeader.parentElement).toHaveClass('border-green-500/70');
    expect(elseHeader.parentElement).toHaveClass('border-red-500/70');
    expect(within(thenHeader).getByRole('button', { name: 'Add command' }).parentElement).toHaveClass('-mr-1');
    expect(within(elseHeader).getByRole('button', { name: 'Add command' }).parentElement).toHaveClass('-mr-1');
    await user.click(within(thenHeader).getByRole('button', { name: 'Add command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Toast' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0].thenCommands).toEqual([{ type: 'toast', text: 'Notification' }]);
    const toastSettings = screen.getByRole('button', { name: 'Toast command settings' });
    expect(toastSettings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toHaveTextContent('Toast');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close command settings' }));

    await user.click(screen.getByRole('button', { name: 'Conditional branch command settings' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Else branch' }));
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).not.toHaveProperty('elseCommands');
  });

  it('does not offer a fourth conditional nesting level', async () => {
    const user = userEvent.setup();
    const condition = { kind: 'switch' as const, id: 'door-open', operand: { kind: 'constant' as const, value: true } };
    const level3: EventCommand = { type: 'conditional', condition, thenCommands: [] };
    const level2: EventCommand = { type: 'conditional', condition, thenCommands: [level3] };
    const level1: EventCommand = { type: 'conditional', condition, thenCommands: [level2] };
    render(<Harness initialContents={[level1]} />);

    const deepestThenBranch = screen.getAllByText('Then').at(-1)!.parentElement!;
    await user.click(within(deepestThenBranch).getByRole('button', { name: 'Add command' }));

    expect(screen.queryByRole('menuitem', { name: 'Conditional branch' })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Toast' })).toBeInTheDocument();
  });

  it('adds, duplicates, navigates and deletes inline pages', async () => {
    render(<Harness withSprite />);
    const pageTabs = within(screen.getByRole('tablist', { name: 'Event pages' }));
    expect(screen.queryByText('Highest page number has priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move page earlier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move page later' })).not.toBeInTheDocument();
    for (const name of ['Add event page', 'Duplicate event page', 'Delete event page']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('data-base-ui-tooltip-trigger');
    }
    expect(screen.getByRole('button', { name: 'Duplicate event page' })).toHaveTextContent('');
    expect(pageTabs.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();

    const through = screen.getByRole('checkbox', { name: 'Through' });
    await userEvent.click(through);
    expect(through).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(2);
    expect(pageTabs.getByRole('tab', { name: '2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Through' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Through' }));
    await userEvent.click(pageTabs.getByRole('tab', { name: '1' }));
    expect(screen.getByRole('checkbox', { name: 'Through' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Add event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(3);
    expect(pageTabs.getByRole('tab', { name: '2' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(2);
    expect(pageTabs.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();
  });
});
