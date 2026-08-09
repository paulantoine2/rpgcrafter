import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Condition, ContentIssue, EventCommand, MapEvent, MapEventPage, MovementCommand, MovementRoute, SourceGame, TeleportMapSource, TeleportNumberSource, VariableComparison } from '@rpgcrafter/game-schema';
import { ArrowDown, ArrowUp, Bell, BringToFront, ChevronsUpDown, Clock3, Copy, Footprints, GitBranch, GitFork, GripVertical, Hand, Hash, HeartPulse, ImageIcon, Layers2, MapPin, MessageSquare, Minus, MousePointerClick, Package, PackageMinus, PackagePlus, Play, Plus, Save, Search, SendToBack, Settings2, Sparkles, ToggleLeft, Trash2, X, type LucideIcon } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '@/components/ui/button';
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from '@/components/ui/attachment';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { IconButtonTooltip, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LibrarySprite } from '@/components/asset-manager-dialog';
import { EventSpritePicker, SpritePreview, spriteReference } from '@/components/event-sprite-picker';
import { SectionHeader, SectionHeaderActions } from '@/components/sidebar-section';
import { cn } from '@/lib/utils';

type Props = {
  game: SourceGame;
  mapId: string;
  event: MapEvent | null;
  issues: ContentIssue[];
  assetUrls: Record<string, string>;
  sprites: LibrarySprite[];
  onChangeEvent: (event: MapEvent) => void;
  onSelectPage?: (index: number) => void;
  onImportSprite: (sprite: LibrarySprite) => Promise<void>;
  onCreateSwitch: (name: string) => string;
  onCreateVariable: (name: string) => string;
  onRenameSwitch: (id: string, name: string) => void;
  onRenameVariable: (id: string, name: string) => void;
  onRenameItem: (id: string, name: string) => void;
};

type ConditionActions = Pick<Props, 'onCreateSwitch' | 'onCreateVariable' | 'onRenameSwitch' | 'onRenameVariable' | 'onRenameItem'>;

const commandGroups: { label: string; types: EventCommand['type'][] }[] = [
  { label: 'Flow & state', types: ['conditional', 'wait', 'setSwitch', 'setVariable', 'save'] },
  { label: 'Dialogue & feedback', types: ['dialogue', 'toast'] },
  { label: 'Player & inventory', types: ['giveItem', 'removeItem', 'unlockSkill', 'healPlayer'] },
  { label: 'Movement & world', types: ['movementRoute', 'teleport'] },
];
const commandTypeLabels: Record<EventCommand['type'], string> = {
  dialogue: 'Dialogue',
  conditional: 'Conditional branch',
  movementRoute: 'Movement route',
  wait: 'Wait',
  setSwitch: 'Set switch',
  setVariable: 'Set variable',
  giveItem: 'Give item',
  removeItem: 'Remove item',
  unlockSkill: 'Unlock skill',
  healPlayer: 'Heal player',
  toast: 'Toast',
  teleport: 'Teleport',
  save: 'Save',
};
const commandTypeIcons: Record<EventCommand['type'], LucideIcon> = {
  dialogue: MessageSquare,
  conditional: GitBranch,
  movementRoute: Footprints,
  wait: Clock3,
  setSwitch: ToggleLeft,
  setVariable: Hash,
  giveItem: PackagePlus,
  removeItem: PackageMinus,
  unlockSkill: Sparkles,
  healPlayer: HeartPulse,
  toast: Bell,
  teleport: MapPin,
  save: Save,
};
const triggerTypes = [
  { type: 'actionButton', label: 'Action Button', icon: MousePointerClick },
  { type: 'playerTouch', label: 'Player Touch', icon: Footprints },
  { type: 'eventTouch', label: 'Event Touch', icon: Hand },
  { type: 'autorun', label: 'Autorun', icon: Play },
  { type: 'parallel', label: 'Parallel', icon: GitFork },
] as const;
const priorityTypes = [
  { type: 'belowCharacters', label: 'Below characters', icon: SendToBack },
  { type: 'sameAsCharacters', label: 'Same as characters', icon: Layers2 },
  { type: 'aboveCharacters', label: 'Above characters', icon: BringToFront },
] as const;

function Section({ title, children, actions, first = false }: { title: string; children: ReactNode; actions?: ReactNode; first?: boolean }) {
  return <section>
    <SectionHeader className={first ? 'border-t-0' : undefined}>{title}{actions && <SectionHeaderActions>{actions}</SectionHeaderActions>}</SectionHeader>
    {children != null && children !== false && <div className="space-y-3 px-4 pb-4">{children}</div>}
  </section>;
}

const fieldLabelClassName = 'text-[10px] font-medium text-muted-foreground';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5"><span className={fieldLabelClassName}>{label}</span>{children}</label>;
}

function NumberInput({ value, onChange, min, max, step = 1, ariaLabel }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; ariaLabel?: string }) {
  return <Input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} aria-label={ariaLabel} onChange={event => onChange(Number(event.target.value))} />;
}

function EnumSelect<T extends string>({ value, values, onChange, labels, ariaLabel, prefix }: { value: T; values: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>>; ariaLabel?: string; prefix?: ReactNode }) {
  return (
    <Select value={value} onValueChange={next => onChange(next as T)}>
      <SelectTrigger className="w-full" aria-label={ariaLabel}>{prefix && <span className="shrink-0 font-medium">{prefix}</span>}<SelectValue>{labels?.[value] || value}</SelectValue></SelectTrigger>
      <SelectContent>{values.map(item => <SelectItem key={item} value={item}>{labels?.[item] || item}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function move<T>(items: T[], index: number, delta: number) {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function moveToInsertionIndex<T>(items: T[], fromIndex: number, insertionIndex: number) {
  const next = items.filter((_, index) => index !== fromIndex);
  next.splice(insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex, 0, items[fromIndex]);
  return next;
}

function hasUnresolvedCommandReference(game: SourceGame, command: EventCommand): boolean {
  if (command.type === 'setSwitch') return !game.initialState.switches[command.id];
  if (command.type === 'setVariable') return !game.initialState.variables[command.id];
  if (command.type === 'conditional') return [...command.thenCommands, ...(command.elseCommands || [])].some(child => hasUnresolvedCommandReference(game, child));
  if (command.type === 'dialogue') return (command.choices || []).some(choice => choice.commands.some(child => hasUnresolvedCommandReference(game, child)));
  return false;
}

function hasUnresolvedCommandReferences(game: SourceGame, commands: EventCommand[]) {
  return commands.some(command => hasUnresolvedCommandReference(game, command));
}

function RowActions({ index, count, onMove, onRemove, removeDisabled }: { index: number; count: number; onMove: (delta: number) => void; onRemove: () => void; removeDisabled?: boolean }) {
  return <div className="flex items-center gap-0.5">
    <IconButtonTooltip label="Move up"><Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp /></Button></IconButtonTooltip>
    <IconButtonTooltip label="Move down"><Button type="button" variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown /></Button></IconButtonTooltip>
    <IconButtonTooltip label="Remove"><Button type="button" variant="ghost" size="icon-sm" disabled={removeDisabled} onClick={onRemove} aria-label="Remove"><Trash2 /></Button></IconButtonTooltip>
  </div>;
}

function defaultCondition(kind: Condition['kind'], game: SourceGame): Condition {
  if (kind === 'switch') return { kind, id: Object.keys(game.initialState.switches)[0] || '', equals: true };
  if (kind === 'item') return { kind, id: Object.keys(game.items)[0] || '', amount: 1 };
  return { kind, id: Object.keys(game.initialState.variables)[0] || '', operator: 'equal', value: 0 };
}

function ConditionIcon({ kind }: { kind: Condition['kind'] }) {
  if (kind === 'switch') return <ToggleLeft aria-hidden="true" />;
  if (kind === 'item') return <Package aria-hidden="true" />;
  return <Hash aria-hidden="true" />;
}

function ConditionSelectIcon({ kind }: { kind: Condition['kind'] }) {
  return <span role="img" aria-label={`${kind} condition`} className="shrink-0 text-muted-foreground [&_svg]:size-3.5"><ConditionIcon kind={kind} /></span>;
}

const normalizePickerQuery = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

function conditionPickerAnchor(trigger: HTMLButtonElement | null) {
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

function AddConditionMenu({ game, onAdd }: { game: SourceGame; onAdd: (condition: Condition) => void }) {
  return <DropdownMenu>
    <IconButtonTooltip label="Add condition"><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add condition"><Plus /></Button>} /></IconButtonTooltip>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onAdd(defaultCondition('switch', game))}><ConditionIcon kind="switch" />Switch</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAdd(defaultCondition('item', game))}><ConditionIcon kind="item" />Item</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAdd(defaultCondition('variable', game))}><ConditionIcon kind="variable" />Variable</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function NewSwitchPopover({ anchor, onCreate }: { anchor: RefObject<HTMLDivElement | null>; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = () => {
    const nextName = name.trim();
    if (!nextName) return;
    onCreate(nextName);
    setName('');
    setOpen(false);
  };
  return <Popover.Root open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setName(''); }}>
    <IconButtonTooltip label="Create switch"><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Create switch"><Plus /></Button>} /></IconButtonTooltip>
    <Popover.Portal>
      <Popover.Positioner anchor={anchor} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-56 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">New switch</SectionHeader>
          <div className="space-y-3 p-3">
            <Field label="Name"><Input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} aria-label="Switch name" /></Field>
            <Button type="button" size="sm" className="w-full" disabled={!name.trim()} onClick={create} aria-label="Confirm switch creation">Create switch</Button>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function SwitchPicker({ game, value, equals, onChange, onCreate, autoOpen = false, onAutoOpen, showIcon = true, showValue = true, anchorToInspector = true }: { game: SourceGame; value: string; equals: boolean; onChange: (id: string) => void; onCreate: (name: string) => string; autoOpen?: boolean; onAutoOpen?: () => void; showIcon?: boolean; showValue?: boolean; anchorToInspector?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
    onAutoOpen?.();
  }, [autoOpen, onAutoOpen]);
  const normalizedQuery = normalizePickerQuery(query.trim());
  const switches = Object.entries(game.initialState.switches).filter(([id, definition]) => !normalizedQuery || normalizePickerQuery(`${definition.name} ${id}`).includes(normalizedQuery));
  const selectedName = game.initialState.switches[value]?.name;
  return <Popover.Root open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setQuery(''); }}>
    <Popover.Trigger render={<Button ref={triggerRef} type="button" variant="outline" className="min-w-0 flex-1 justify-between font-normal" aria-label="Choose switch">{showIcon && <ConditionSelectIcon kind="switch" />}<span className="min-w-0 flex-1 truncate text-left">{selectedName || 'Choose a switch'}</span>{showValue && <span className="shrink-0 text-muted-foreground">{equals ? 'True' : 'False'}</span>}<ChevronsUpDown className="text-muted-foreground" /></Button>} />
    <Popover.Portal>
      <Popover.Positioner anchor={() => anchorToInspector ? conditionPickerAnchor(triggerRef.current) : triggerRef.current} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup ref={popupRef} className="w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">Switches</span>
            <SectionHeaderActions><NewSwitchPopover anchor={popupRef} onCreate={name => {
              const id = onCreate(name);
              if (id) {
                onChange(id);
                setOpen(false);
              }
            }} />
            <IconButtonTooltip label="Close switch picker"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close switch picker" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} className="h-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" aria-label="Search switches" placeholder="Search switches…" />
          </div>
          <ScrollArea className="max-h-56">
            <div role="listbox" aria-label="Switches">
              {switches.map(([id, definition]) => <button key={id} type="button" role="option" aria-selected={id === value} className={`flex h-9 w-full items-center px-3 text-left text-xs outline-none ${id === value ? 'bg-primary/15 text-foreground hover:bg-primary/20 focus-visible:bg-primary/20' : 'hover:bg-accent focus-visible:bg-accent'}`} onClick={() => { onChange(id); setOpen(false); setQuery(''); }}>
                <span className="min-w-0 flex-1 truncate">{definition.name}</span>
              </button>)}
              {!switches.length && <p className="px-2 py-4 text-center text-[10px] text-muted-foreground">No switches found.</p>}
            </div>
          </ScrollArea>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function NewVariablePopover({ anchor, onCreate }: { anchor: RefObject<HTMLDivElement | null>; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = () => {
    const nextName = name.trim();
    if (!nextName) return;
    onCreate(nextName);
    setName('');
    setOpen(false);
  };
  return <Popover.Root open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setName(''); }}>
    <IconButtonTooltip label="Create variable"><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Create variable"><Plus /></Button>} /></IconButtonTooltip>
    <Popover.Portal>
      <Popover.Positioner anchor={anchor} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-56 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">New variable</SectionHeader>
          <div className="space-y-3 p-3">
            <Field label="Name"><Input autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} aria-label="Variable name" /></Field>
            <Button type="button" size="sm" className="w-full" disabled={!name.trim()} onClick={create} aria-label="Confirm variable creation">Create variable</Button>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

const variableComparisonSymbols: Record<VariableComparison, string> = {
  equal: '=',
  notEqual: '≠',
  greaterThan: '>',
  greaterThanOrEqual: '≥',
  lessThan: '<',
  lessThanOrEqual: '≤',
};

function VariablePicker({ game, condition, onChange, onCreate, autoOpen = false, onAutoOpen, showIcon = true, showComparison = true, anchorToInspector = true }: { game: SourceGame; condition: Extract<Condition, { kind: 'variable' }>; onChange: (id: string) => void; onCreate: (name: string) => string; autoOpen?: boolean; onAutoOpen?: () => void; showIcon?: boolean; showComparison?: boolean; anchorToInspector?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
    onAutoOpen?.();
  }, [autoOpen, onAutoOpen]);
  const normalizedQuery = normalizePickerQuery(query.trim());
  const variables = Object.entries(game.initialState.variables).filter(([id, definition]) => !normalizedQuery || normalizePickerQuery(`${definition.name} ${id}`).includes(normalizedQuery));
  const selectedName = game.initialState.variables[condition.id]?.name;
  return <Popover.Root open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setQuery(''); }}>
    <Popover.Trigger render={<Button ref={triggerRef} type="button" variant="outline" className="min-w-0 w-full justify-between font-normal" aria-label="Choose variable">{showIcon && <ConditionSelectIcon kind="variable" />}<span className="min-w-0 flex-1 truncate text-left">{selectedName || 'Choose a variable'}</span>{showComparison && <span className="shrink-0 text-muted-foreground">{variableComparisonSymbols[condition.operator]} {condition.value}</span>}<ChevronsUpDown className="text-muted-foreground" /></Button>} />
    <Popover.Portal>
      <Popover.Positioner anchor={() => anchorToInspector ? conditionPickerAnchor(triggerRef.current) : triggerRef.current} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup ref={popupRef} className="w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">Variables</span>
            <SectionHeaderActions><NewVariablePopover anchor={popupRef} onCreate={name => {
              const id = onCreate(name);
              if (id) {
                onChange(id);
                setOpen(false);
              }
            }} />
            <IconButtonTooltip label="Close variable picker"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close variable picker" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} className="h-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" aria-label="Search variables" placeholder="Search variables…" />
          </div>
          <ScrollArea className="max-h-56">
            <div role="listbox" aria-label="Variables">
              {variables.map(([id, definition]) => <button key={id} type="button" role="option" aria-selected={id === condition.id} className={`flex h-9 w-full items-center px-3 text-left text-xs outline-none ${id === condition.id ? 'bg-primary/15 text-foreground hover:bg-primary/20 focus-visible:bg-primary/20' : 'hover:bg-accent focus-visible:bg-accent'}`} onClick={() => { onChange(id); setOpen(false); setQuery(''); }}>
                <span className="min-w-0 flex-1 truncate">{definition.name}</span>
              </button>)}
              {!variables.length && <p className="px-2 py-4 text-center text-[10px] text-muted-foreground">No variables found.</p>}
            </div>
          </ScrollArea>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function ItemPicker({ game, value, amount, onChange, showIcon = true, anchorToInspector = true }: { game: SourceGame; value: string; amount: number; onChange: (id: string) => void; showIcon?: boolean; anchorToInspector?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const normalizedQuery = normalizePickerQuery(query.trim());
  const items = Object.entries(game.items).filter(([id, item]) => !normalizedQuery || normalizePickerQuery(`${item.name} ${id}`).includes(normalizedQuery));
  const selectedName = game.items[value]?.name;
  return <Popover.Root open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (!nextOpen) setQuery(''); }}>
    <Popover.Trigger render={<Button ref={triggerRef} type="button" variant="outline" className="min-w-0 w-full justify-between font-normal" aria-label="Choose item">{showIcon && <ConditionSelectIcon kind="item" />}<span className="min-w-0 flex-1 truncate text-left">{selectedName || 'Choose an item'}</span><span className="shrink-0 text-muted-foreground">×{amount}</span><ChevronsUpDown className="text-muted-foreground" /></Button>} />
    <Popover.Portal>
      <Popover.Positioner anchor={() => anchorToInspector ? conditionPickerAnchor(triggerRef.current) : triggerRef.current} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">Items</span>
            <SectionHeaderActions><IconButtonTooltip label="Close item picker"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close item picker" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} className="h-full border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent" aria-label="Search items" placeholder="Search items…" />
          </div>
          <ScrollArea className="max-h-56">
            <div role="listbox" aria-label="Items">
              {items.map(([id, item]) => <button key={id} type="button" role="option" aria-selected={id === value} className={`flex h-9 w-full items-center px-3 text-left text-xs outline-none ${id === value ? 'bg-primary/15 text-foreground hover:bg-primary/20 focus-visible:bg-primary/20' : 'hover:bg-accent focus-visible:bg-accent'}`} onClick={() => { onChange(id); setOpen(false); setQuery(''); }}>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </button>)}
              {!items.length && <p className="px-2 py-4 text-center text-[10px] text-muted-foreground">No items found.</p>}
            </div>
          </ScrollArea>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function ConditionSettings({ game, condition, onChange, onRenameSwitch, onRenameVariable, onRenameItem }: { game: SourceGame; condition: Condition; onChange: (condition: Condition) => void; onRenameSwitch: (id: string, name: string) => void; onRenameVariable: (id: string, name: string) => void; onRenameItem: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const kindLabel = condition.kind === 'switch' ? 'Switch' : condition.kind === 'item' ? 'Item' : 'Variable';
  const definitionName = condition.kind === 'switch'
    ? game.initialState.switches[condition.id]?.name
    : condition.kind === 'item'
      ? game.items[condition.id]?.name
      : game.initialState.variables[condition.id]?.name;
  const rename = (name: string) => {
    const nextName = name.trim();
    if (!nextName || nextName === definitionName) return;
    if (condition.kind === 'switch') onRenameSwitch(condition.id, nextName);
    else if (condition.kind === 'item') onRenameItem(condition.id, nextName);
    else onRenameVariable(condition.id, nextName);
  };
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <IconButtonTooltip label={`${kindLabel} condition settings`}><Popover.Trigger render={<Button ref={triggerRef} type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label={`${kindLabel} condition settings`}><Settings2 /></Button>} /></IconButtonTooltip>
    <Popover.Portal>
      <Popover.Positioner anchor={() => conditionPickerAnchor(triggerRef.current)} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-72 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">{kindLabel} condition</span>
            <SectionHeaderActions><IconButtonTooltip label="Close condition settings"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close condition settings" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="space-y-3 p-3">
            <Field label={`${kindLabel} name`}><Input key={`${condition.id}:${definitionName}`} defaultValue={definitionName || ''} disabled={!definitionName} onBlur={event => rename(event.currentTarget.value)} /></Field>
            {condition.kind === 'switch'
              ? <Field label="Expected value"><span className="flex items-center gap-2 text-xs"><Switch checked={condition.equals ?? true} onCheckedChange={equals => onChange({ ...condition, equals })} aria-label="Expected switch value" /><span>{(condition.equals ?? true) ? 'True' : 'False'}</span></span></Field>
              : condition.kind === 'item'
                ? <Field label="Required quantity"><NumberInput value={condition.amount ?? 1} min={1} onChange={amount => onChange({ ...condition, amount })} /></Field>
                : <><Field label="Comparison"><EnumSelect value={condition.operator} values={Object.keys(variableComparisonSymbols) as VariableComparison[]} labels={{ equal: '= Equal', notEqual: '≠ Not equal', greaterThan: '> Greater than', greaterThanOrEqual: '≥ Greater than or equal', lessThan: '< Less than', lessThanOrEqual: '≤ Less than or equal' }} ariaLabel="Variable comparison" onChange={operator => onChange({ ...condition, operator })} /></Field><Field label="Value"><NumberInput value={condition.value} onChange={value => onChange({ ...condition, value })} /></Field></>}
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function ConditionsEditor({ game, value, onChange, onCreateSwitch, onCreateVariable, onRenameSwitch, onRenameVariable, onRenameItem, autoOpenSwitchIndex, autoOpenVariableIndex, onAutoOpenSwitch, onAutoOpenVariable, removeDisabled = false }: { game: SourceGame; value: Condition[]; onChange: (value: Condition[]) => void; onCreateSwitch: (name: string) => string; onCreateVariable: (name: string) => string; onRenameSwitch: (id: string, name: string) => void; onRenameVariable: (id: string, name: string) => void; onRenameItem: (id: string, name: string) => void; autoOpenSwitchIndex: number | null; autoOpenVariableIndex: number | null; onAutoOpenSwitch: () => void; onAutoOpenVariable: () => void; removeDisabled?: boolean }) {
  const update = (index: number, condition: Condition) => onChange(value.map((item, itemIndex) => itemIndex === index ? condition : item));
  return <div className="space-y-2">
    {value.map((condition, index) => <div key={index} className="flex min-w-0 items-center gap-2">
      {condition.kind === 'switch' && <div className="flex min-w-0 flex-1">
        <SwitchPicker game={game} value={condition.id} equals={condition.equals ?? true} onChange={id => update(index, { ...condition, id })} onCreate={onCreateSwitch} autoOpen={autoOpenSwitchIndex === index} onAutoOpen={onAutoOpenSwitch} />
      </div>}
      {condition.kind === 'item' && <div className="min-w-0 flex-1">
        <ItemPicker game={game} value={condition.id} amount={condition.amount ?? 1} onChange={id => update(index, { ...condition, id })} />
      </div>}
      {condition.kind === 'variable' && <div className="min-w-0 flex-1">
        <VariablePicker game={game} condition={condition} onChange={id => update(index, { ...condition, id })} onCreate={onCreateVariable} autoOpen={autoOpenVariableIndex === index} onAutoOpen={onAutoOpenVariable} />
      </div>}
      <div className="-mr-1 flex shrink-0 items-center gap-0.5"><ConditionSettings game={game} condition={condition} onChange={next => update(index, next)} onRenameSwitch={onRenameSwitch} onRenameVariable={onRenameVariable} onRenameItem={onRenameItem} />
        <IconButtonTooltip label={`Remove ${condition.kind} condition`}><Button type="button" variant="ghost" size="icon-sm" className="shrink-0" disabled={removeDisabled} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${condition.kind} condition`}><Minus /></Button></IconButtonTooltip></div>
    </div>)}
  </div>;
}

function defaultCommand(type: EventCommand['type'], game: SourceGame): EventCommand {
  const gameSwitch = Object.keys(game.initialState.switches)[0] || '';
  const variable = Object.keys(game.initialState.variables)[0] || '';
  const item = Object.keys(game.items)[0] || '';
  const skill = Object.keys(game.skills)[0] || '';
  const mapId = Object.keys(game.maps)[0] || '';
  if (type === 'dialogue') return { type, speaker: 'Speaker', text: 'Dialogue text', choices: [] };
  if (type === 'conditional') return { type, condition: defaultCondition('switch', game), thenCommands: [] };
  if (type === 'setSwitch') return { type, id: gameSwitch, value: true };
  if (type === 'setVariable') return { type, id: variable, value: 0 };
  if (type === 'giveItem' || type === 'removeItem') return { type, id: item, amount: 1 };
  if (type === 'unlockSkill') return { type, id: skill };
  if (type === 'healPlayer') return { type, amount: 10 };
  if (type === 'toast') return { type, text: 'Notification' };
  if (type === 'teleport') return { type, destination: { map: { kind: 'constant', mapId }, x: { kind: 'constant', value: 0 }, y: { kind: 'constant', value: 0 } }, direction: 'retain', transition: 'instant' };
  if (type === 'movementRoute') return { type, target: { kind: 'thisEvent' }, route: { commands: [], repeat: false, skippable: false, wait: true } };
  if (type === 'wait') return { type, duration: 0.5 };
  return { type: 'save' };
}

const moveDirections = ['north', 'east', 'south', 'west', 'forward', 'backward', 'random', 'towardPlayer', 'awayFromPlayer', 'left', 'right'] as const;
const turnDirections = ['north', 'east', 'south', 'west', 'left', 'right', 'around', 'random', 'towardPlayer', 'awayFromPlayer'] as const;
function defaultMovementCommand(type: MovementCommand['type']): MovementCommand {
  if (type === 'move') return { type, direction: 'forward' };
  if (type === 'turn') return { type, direction: 'south' };
  if (type === 'jump') return { type, x: 0, y: -1 };
  return { type: 'wait', duration: 0.5 };
}

function AddMovementCommandMenu({ onAdd }: { onAdd: (command: MovementCommand) => void }) {
  return <DropdownMenu>
    <IconButtonTooltip label="Add movement command"><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add movement command"><Plus /></Button>} /></IconButtonTooltip>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onAdd(defaultMovementCommand('move'))}>Move</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAdd(defaultMovementCommand('turn'))}>Turn</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAdd(defaultMovementCommand('jump'))}>Jump</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAdd(defaultMovementCommand('wait'))}>Wait</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function LoopingRouteEditor({ value, onChange }: { value: MovementCommand[]; onChange: (value: MovementCommand[]) => void }) {
  const update = (index: number, command: MovementCommand) => onChange(value.map((item, itemIndex) => itemIndex === index ? command : item));
  const remove = (index: number) => onChange(value.filter((_, itemIndex) => itemIndex !== index));
  return <Section title="Looping route" actions={<AddMovementCommandMenu onAdd={command => onChange([...value, command])} />}>
    <div className="space-y-2">
      {value.map((command, index) => <div key={index} className="flex min-w-0 items-center gap-2">
        {command.type === 'move' && <div className="min-w-0 flex-1"><EnumSelect value={command.direction} values={moveDirections} ariaLabel="Move direction" prefix="Move" onChange={direction => update(index, { ...command, direction })} /></div>}
        {command.type === 'turn' && <div className="min-w-0 flex-1"><EnumSelect value={command.direction} values={turnDirections} ariaLabel="Turn direction" prefix="Turn" onChange={direction => update(index, { ...command, direction })} /></div>}
        {command.type === 'jump' && <div className="flex h-8 min-w-0 flex-1 items-center border border-input focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50"><span className="shrink-0 px-2.5 text-xs font-medium">Jump</span><label className="flex min-w-0 flex-1 items-center gap-1 text-[10px]">X<Input type="number" value={command.x} className="h-7 border-0 bg-transparent px-1 focus-visible:ring-0 dark:bg-transparent" onChange={event => update(index, { ...command, x: Number(event.target.value) })} /></label><label className="flex min-w-0 flex-1 items-center gap-1 text-[10px]">Y<Input type="number" value={command.y} className="h-7 border-0 bg-transparent px-1 focus-visible:ring-0 dark:bg-transparent" onChange={event => update(index, { ...command, y: Number(event.target.value) })} /></label></div>}
        {command.type === 'wait' && <label className="flex h-8 min-w-0 flex-1 items-center border border-input focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50"><span className="shrink-0 px-2.5 text-xs font-medium">Wait</span><Input type="number" value={command.duration} min={0} step={0.1} className="h-7 border-0 bg-transparent focus-visible:ring-0 dark:bg-transparent" onChange={event => update(index, { ...command, duration: Number(event.target.value) })} /></label>}
        <IconButtonTooltip label={`Remove ${command.type} command`}><Button type="button" variant="ghost" size="icon-sm" className="-mr-1 shrink-0" onClick={() => remove(index)} aria-label={`Remove ${command.type} command`}><Minus /></Button></IconButtonTooltip>
      </div>)}
      {!value.length && <p className="py-2 text-center text-[10px] text-muted-foreground">No movement commands.</p>}
    </div>
  </Section>;
}

function AutonomousMovementSettings({ movement, onChange }: { movement: MapEventPage['movement']; onChange: (movement: MapEventPage['movement']) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <IconButtonTooltip label="Autonomous movement settings"><Popover.Trigger render={<Button ref={triggerRef} type="button" variant="ghost" size="icon-sm" className="-mr-1" aria-label="Autonomous movement settings"><Settings2 /></Button>} /></IconButtonTooltip>
    <Popover.Portal>
      <Popover.Positioner anchor={() => conditionPickerAnchor(triggerRef.current)} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-80 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">Autonomous movement</span>
            <SectionHeaderActions><IconButtonTooltip label="Close autonomous movement settings"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close autonomous movement settings" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="grid gap-4 p-3">
            <label className="grid grid-cols-2 items-center gap-3 text-[10px]"><span>Speed · {movement.speed}</span><Slider aria-label="Movement speed" value={movement.speed} min={1} max={6} step={1} onValueChange={speed => onChange({ ...movement, speed: speed as MapEventPage['movement']['speed'] })} /></label>
            <label className="grid grid-cols-2 items-center gap-3 text-[10px]"><span>Frequency · {movement.frequency}</span><Slider aria-label="Movement frequency" value={movement.frequency} min={1} max={5} step={1} onValueChange={frequency => onChange({ ...movement, frequency: frequency as MapEventPage['movement']['frequency'] })} /></label>
          </div>
          {movement.type === 'custom' && <LoopingRouteEditor value={movement.route} onChange={route => onChange({ ...movement, route })} />}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function MovementCommandsEditor({ value, onChange }: { value: MovementCommand[]; onChange: (value: MovementCommand[]) => void }) {
  const update = (index: number, command: MovementCommand) => onChange(value.map((item, itemIndex) => itemIndex === index ? command : item));
  return <div className="space-y-2">
    {value.map((command, index) => <div key={index} className="space-y-2 border bg-muted/15 p-2">
      <div className="flex items-center justify-between gap-2"><EnumSelect value={command.type} values={['move', 'turn', 'jump', 'wait'] as const} onChange={type => update(index, defaultMovementCommand(type))} /><RowActions index={index} count={value.length} onMove={delta => onChange(move(value, index, delta))} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} /></div>
      {command.type === 'move' && <EnumSelect value={command.direction} values={moveDirections} onChange={direction => update(index, { ...command, direction })} />}
      {command.type === 'turn' && <EnumSelect value={command.direction} values={turnDirections} onChange={direction => update(index, { ...command, direction })} />}
      {command.type === 'jump' && <div className="grid grid-cols-2 gap-2"><Field label="X offset"><NumberInput value={command.x} onChange={x => update(index, { ...command, x })} /></Field><Field label="Y offset"><NumberInput value={command.y} onChange={y => update(index, { ...command, y })} /></Field></div>}
      {command.type === 'wait' && <Field label="Seconds"><NumberInput value={command.duration} min={0} step={0.1} onChange={duration => update(index, { ...command, duration })} /></Field>}
    </div>)}
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...value, defaultMovementCommand('move')])}><Plus /> Add movement command</Button>
  </div>;
}
function MovementRouteEditor({ value, onChange, showWait = true }: { value: MovementRoute; onChange: (value: MovementRoute) => void; showWait?: boolean }) {
  return <div className="space-y-2">
    <MovementCommandsEditor value={value.commands} onChange={commands => onChange({ ...value, commands })} />
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.repeat} onCheckedChange={repeat => onChange({ ...value, repeat, wait: repeat ? false : value.wait })} />Repeat route</label>
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.skippable} onCheckedChange={skippable => onChange({ ...value, skippable })} />Skip if cannot move</label>
      {showWait && <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.wait} disabled={value.repeat} onCheckedChange={wait => onChange({ ...value, wait })} />Wait for completion</label>}
    </div>
  </div>;
}

function ConditionalConditionFields({ game, condition, onChange, conditionActions }: { game: SourceGame; condition: Condition; onChange: (condition: Condition) => void; conditionActions: ConditionActions }) {
  const conditionTypeLabels = { switch: 'Switch', variable: 'Variable', item: 'Item' } as const;
  return <div className="space-y-3">
    <Field label="Condition type">
      <EnumSelect value={condition.kind} values={['switch', 'variable', 'item'] as const} labels={conditionTypeLabels} ariaLabel="Condition type" prefix={<ConditionSelectIcon kind={condition.kind} />} onChange={kind => onChange(defaultCondition(kind, game))} />
    </Field>
    {condition.kind === 'switch' && <>
      <Field label="Switch">
        <div className="flex min-w-0"><SwitchPicker game={game} value={condition.id} equals={condition.equals ?? true} onChange={id => onChange({ ...condition, id })} onCreate={conditionActions.onCreateSwitch} showIcon={false} anchorToInspector={false} /></div>
      </Field>
      <Field label="Expected value"><span className="flex items-center gap-2 text-xs"><Switch checked={condition.equals ?? true} onCheckedChange={equals => onChange({ ...condition, equals })} aria-label="Expected switch value" /><span>{(condition.equals ?? true) ? 'True' : 'False'}</span></span></Field>
    </>}
    {condition.kind === 'variable' && <>
      <Field label="Variable">
        <VariablePicker game={game} condition={condition} onChange={id => onChange({ ...condition, id })} onCreate={conditionActions.onCreateVariable} showIcon={false} anchorToInspector={false} />
      </Field>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Field label="Comparison"><EnumSelect value={condition.operator} values={Object.keys(variableComparisonSymbols) as VariableComparison[]} labels={{ equal: '= Equal', notEqual: '≠ Not equal', greaterThan: '> Greater than', greaterThanOrEqual: '≥ Greater than or equal', lessThan: '< Less than', lessThanOrEqual: '≤ Less than or equal' }} ariaLabel="Variable comparison" onChange={operator => onChange({ ...condition, operator })} /></Field>
        <Field label="Value"><NumberInput value={condition.value} ariaLabel="Value" onChange={value => onChange({ ...condition, value })} /></Field>
      </div>
    </>}
    {condition.kind === 'item' && <>
      <Field label="Item">
        <ItemPicker game={game} value={condition.id} amount={condition.amount ?? 1} onChange={id => onChange({ ...condition, id })} showIcon={false} anchorToInspector={false} />
      </Field>
      <Field label="Required quantity"><NumberInput value={condition.amount ?? 1} min={1} ariaLabel="Required quantity" onChange={amount => onChange({ ...condition, amount })} /></Field>
    </>}
  </div>;
}

const teleportSourceLabels = { constant: 'Fixed', variable: 'Variable' } as const;
function TeleportMapField({ game, value, onChange }: { game: SourceGame; value: TeleportMapSource; onChange: (value: TeleportMapSource) => void }) {
  const mapIds = Object.keys(game.maps);
  const variableIds = Object.keys(game.initialState.variables);
  return <Field label="Map"><div className="grid grid-cols-2 gap-2">
    <EnumSelect value={value.kind} values={['constant', 'variable'] as const} labels={teleportSourceLabels} ariaLabel="Map source" onChange={kind => onChange(kind === 'constant' ? { kind, mapId: mapIds[0] || '' } : { kind, variableId: variableIds[0] || '' })} />
    {value.kind === 'constant'
      ? <EnumSelect value={value.mapId} values={mapIds} labels={Object.fromEntries(Object.entries(game.maps).map(([id, map]) => [id, `#${map.numericId} · ${map.name}`]))} ariaLabel="Destination map" onChange={mapId => onChange({ kind: 'constant', mapId })} />
      : <EnumSelect value={value.variableId} values={variableIds} labels={Object.fromEntries(Object.entries(game.initialState.variables).map(([id, definition]) => [id, definition.name]))} ariaLabel="Map variable" onChange={variableId => onChange({ kind: 'variable', variableId })} />}
  </div></Field>;
}

function TeleportNumberField({ game, label, value, onChange }: { game: SourceGame; label: 'X' | 'Y'; value: TeleportNumberSource; onChange: (value: TeleportNumberSource) => void }) {
  const variableIds = Object.keys(game.initialState.variables);
  return <Field label={label}><div className="grid grid-cols-2 gap-2">
    <EnumSelect value={value.kind} values={['constant', 'variable'] as const} labels={teleportSourceLabels} ariaLabel={`${label} source`} onChange={kind => onChange(kind === 'constant' ? { kind, value: 0 } : { kind, variableId: variableIds[0] || '' })} />
    {value.kind === 'constant'
      ? <NumberInput value={value.value} step={1} ariaLabel={`${label} coordinate`} onChange={nextValue => onChange({ kind: 'constant', value: Math.trunc(nextValue) })} />
      : <EnumSelect value={value.variableId} values={variableIds} labels={Object.fromEntries(Object.entries(game.initialState.variables).map(([id, definition]) => [id, definition.name]))} ariaLabel={`${label} variable`} onChange={variableId => onChange({ kind: 'variable', variableId })} />}
  </div></Field>;
}

type CommandAutoOpenProps = {
  autoOpenCommand?: EventCommand | null;
  onAutoOpenCommand?: () => void;
  onCommandAdded?: (command: EventCommand) => void;
};

function CommandFields({ game, mapId, command, onChange, conditionalDepth, conditionActions, autoOpenCommand, onAutoOpenCommand, onCommandAdded }: { game: SourceGame; mapId: string; command: EventCommand; onChange: (command: EventCommand) => void; conditionalDepth: number; conditionActions: ConditionActions } & CommandAutoOpenProps) {
  const [autoOpenMissingReference, setAutoOpenMissingReference] = useState(true);
  const action = command;
  if (action.type === 'dialogue') return <div className="space-y-2">
    <Input value={action.speaker} placeholder="Speaker" onChange={event => onChange({ ...action, speaker: event.target.value })} />
    <Textarea value={action.text} placeholder="Dialogue text" onChange={event => onChange({ ...action, text: event.target.value })} />
    <div className="space-y-2 border-l-2 border-primary/25 pl-2">
      {(action.choices || []).map((choice, index) => <div key={index} className="space-y-2 border bg-background p-2">
        <div className="flex gap-2"><Input value={choice.label} placeholder="Choice label" onChange={event => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /><IconButtonTooltip label="Remove choice"><Button variant="ghost" size="icon-sm" aria-label="Remove choice" onClick={() => onChange({ ...action, choices: action.choices!.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></IconButtonTooltip></div>
        <CommandsEditor game={game} mapId={mapId} value={choice.commands} conditionalDepth={conditionalDepth} conditionActions={conditionActions} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={onAutoOpenCommand} onCommandAdded={onCommandAdded} onChange={commands => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, commands } : item) })} />
      </div>)}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...action, choices: [...(action.choices || []), { label: 'Choice', commands: [] }] })}><Plus /> Add choice</Button>
    </div>
  </div>;
  if (action.type === 'conditional') {
    return <div className="space-y-3">
      <ConditionalConditionFields game={game} condition={action.condition} conditionActions={conditionActions} onChange={condition => onChange({ ...action, condition })} />
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={Boolean(action.elseCommands)} onCheckedChange={enabled => {
        if (enabled) onChange({ ...action, elseCommands: [] });
        else { const next = { ...action }; delete next.elseCommands; onChange(next); }
      }} />Else branch</label>
    </div>;
  }
  if (action.type === 'setSwitch') return <div className="grid gap-2"><Field label="Switch"><div className="flex min-w-0"><SwitchPicker game={game} value={action.id} equals={action.value} onChange={id => onChange({ ...action, id })} onCreate={conditionActions.onCreateSwitch} autoOpen={autoOpenMissingReference && !game.initialState.switches[action.id]} onAutoOpen={() => setAutoOpenMissingReference(false)} showIcon={false} showValue={false} anchorToInspector={false} /></div></Field><label className="flex items-center gap-2 text-xs"><Checkbox checked={action.value} onCheckedChange={value => onChange({ ...action, value })} />Set on</label></div>;
  if (action.type === 'setVariable') return <div className="grid grid-cols-[1fr_88px] gap-2"><Field label="Variable"><VariablePicker game={game} condition={{ kind: 'variable', id: action.id, operator: 'equal', value: action.value }} onChange={id => onChange({ ...action, id })} onCreate={conditionActions.onCreateVariable} autoOpen={autoOpenMissingReference && !game.initialState.variables[action.id]} onAutoOpen={() => setAutoOpenMissingReference(false)} showIcon={false} showComparison={false} anchorToInspector={false} /></Field><Field label="Value"><NumberInput value={action.value} onChange={value => onChange({ ...action, value })} /></Field></div>;
  if (action.type === 'giveItem' || action.type === 'removeItem') return <div className="grid grid-cols-[1fr_88px] gap-2"><EnumSelect value={action.id} values={Object.keys(game.items)} onChange={id => onChange({ ...action, id })} /><NumberInput value={action.amount ?? 1} min={1} onChange={amount => onChange({ ...action, amount })} /></div>;
  if (action.type === 'unlockSkill') return <EnumSelect value={action.id} values={Object.keys(game.skills)} onChange={id => onChange({ ...action, id })} />;
  if (action.type === 'healPlayer') return <NumberInput value={action.amount} onChange={amount => onChange({ ...action, amount })} />;
  if (action.type === 'toast') return <Textarea value={action.text} onChange={event => onChange({ ...action, text: event.target.value })} />;
  if (action.type === 'teleport') return <div className="space-y-3">
    <TeleportMapField game={game} value={action.destination.map} onChange={map => onChange({ ...action, destination: { ...action.destination, map } })} />
    <TeleportNumberField game={game} label="X" value={action.destination.x} onChange={x => onChange({ ...action, destination: { ...action.destination, x } })} />
    <TeleportNumberField game={game} label="Y" value={action.destination.y} onChange={y => onChange({ ...action, destination: { ...action.destination, y } })} />
    <div className="grid grid-cols-2 gap-2"><Field label="Direction"><EnumSelect value={action.direction} values={['retain', 'north', 'east', 'south', 'west'] as const} labels={{ retain: 'Keep current', north: 'North', east: 'East', south: 'South', west: 'West' }} ariaLabel="Player direction" onChange={direction => onChange({ ...action, direction })} /></Field><Field label="Transition"><EnumSelect value={action.transition} values={['instant', 'fadeBlack', 'fadeWhite'] as const} labels={{ instant: 'Instant', fadeBlack: 'Fade to black', fadeWhite: 'Fade to white' }} ariaLabel="Teleport transition" onChange={transition => onChange({ ...action, transition })} /></Field></div>
  </div>;
  if (action.type === 'movementRoute') {
    const targetValue = action.target.kind === 'event' ? `event:${action.target.eventId}` : action.target.kind;
    const targetValues = ['player', 'thisEvent', ...game.maps[mapId].events.map(event => `event:${event.id}`)] as string[];
    return <div className="space-y-3"><Field label="Target"><EnumSelect value={targetValue} values={targetValues} labels={{ player: 'Player', thisEvent: 'This event' }} onChange={value => onChange({ ...action, target: value === 'player' ? { kind: 'player' } : value === 'thisEvent' ? { kind: 'thisEvent' } : { kind: 'event', eventId: value.slice(6) } })} /></Field><MovementRouteEditor value={action.route} onChange={route => onChange({ ...action, route })} /></div>;
  }
  if (action.type === 'wait') return <Field label="Seconds"><NumberInput value={action.duration} min={0} step={0.1} onChange={duration => onChange({ ...action, duration })} /></Field>;
  return <p className="text-xs text-muted-foreground">No parameters.</p>;
}

function commandRowContent(game: SourceGame, command: EventCommand): { label: string; value?: string } {
  if (command.type === 'dialogue') return { label: 'Dialogue', value: command.speaker || 'No speaker' };
  if (command.type === 'conditional') {
    const condition = command.condition;
    if (condition.kind === 'switch') return { label: 'If', value: `${game.initialState.switches[condition.id]?.name || condition.id} is ${(condition.equals ?? true) ? 'true' : 'false'}` };
    if (condition.kind === 'item') return { label: 'If', value: `${game.items[condition.id]?.name || condition.id} ×${condition.amount ?? 1}` };
    return { label: 'If', value: `${game.initialState.variables[condition.id]?.name || condition.id} ${variableComparisonSymbols[condition.operator]} ${condition.value}` };
  }
  if (command.type === 'setSwitch') return { label: 'Set', value: `${game.initialState.switches[command.id]?.name || command.id || 'Choose a switch'} · ${command.value ? 'On' : 'Off'}` };
  if (command.type === 'setVariable') return { label: 'Set', value: `${game.initialState.variables[command.id]?.name || command.id || 'Choose a variable'} · ${command.value}` };
  if (command.type === 'giveItem') return { label: 'Give', value: `${game.items[command.id]?.name || command.id} ×${command.amount ?? 1}` };
  if (command.type === 'removeItem') return { label: 'Remove', value: `${game.items[command.id]?.name || command.id} ×${command.amount ?? 1}` };
  if (command.type === 'unlockSkill') return { label: 'Unlock', value: game.skills[command.id]?.name || command.id };
  if (command.type === 'healPlayer') return { label: 'Heal', value: `${command.amount} HP` };
  if (command.type === 'toast') return { label: 'Toast', value: command.text };
  if (command.type === 'teleport') {
    const mapName = command.destination.map.kind === 'constant'
      ? game.maps[command.destination.map.mapId]?.name || command.destination.map.mapId
      : game.initialState.variables[command.destination.map.variableId]?.name || command.destination.map.variableId;
    return { label: 'Teleport', value: mapName };
  }
  if (command.type === 'movementRoute') return { label: 'Move', value: command.target.kind === 'player' ? 'Player' : command.target.kind === 'thisEvent' ? 'This event' : command.target.eventId };
  if (command.type === 'wait') return { label: 'Wait', value: `${command.duration}s` };
  return { label: 'Save' };
}

function AddCommandMenu({ game, onAdd, conditionalDepth = 0 }: { game: SourceGame; onAdd: (command: EventCommand) => void; conditionalDepth?: number }) {
  const availableGroups = commandGroups.map(group => ({
    ...group,
    types: group.types.filter(type => type !== 'conditional' || conditionalDepth < 3),
  })).filter(group => group.types.length > 0);
  return <DropdownMenu>
    <IconButtonTooltip label="Add command"><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add command"><Plus /></Button>} /></IconButtonTooltip>
    <DropdownMenuContent align="end" className="w-64">
      {availableGroups.map((group, groupIndex) => <Fragment key={group.label}>
        {groupIndex > 0 && <DropdownMenuSeparator />}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
          {group.types.map(type => {
            const CommandIcon = commandTypeIcons[type];
            return <DropdownMenuItem key={type} onClick={() => onAdd(defaultCommand(type, game))}><CommandIcon aria-hidden="true" />{commandTypeLabels[type]}</DropdownMenuItem>;
          })}
        </DropdownMenuGroup>
      </Fragment>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function CommandSettings({ game, mapId, command, onChange, conditionalDepth, conditionActions, autoOpen = false, onAutoOpen, autoOpenCommand, onAutoOpenCommand, onCommandAdded }: { game: SourceGame; mapId: string; command: EventCommand; onChange: (command: EventCommand) => void; conditionalDepth: number; conditionActions: ConditionActions; autoOpen?: boolean; onAutoOpen?: () => void } & CommandAutoOpenProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const CommandIcon = commandTypeIcons[command.type];
  const rowContent = commandRowContent(game, command);
  useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
    onAutoOpen?.();
  }, [autoOpen, onAutoOpen]);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Toggle ref={triggerRef} variant="outline" className="min-w-0 flex-1 justify-start font-normal" pressed={open} onPressedChange={setOpen} aria-label={`${commandTypeLabels[command.type]} command settings`} aria-haspopup="dialog" aria-expanded={open}>
      <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5"><CommandIcon aria-hidden="true" /></span>
      <span className="shrink-0 text-foreground">{rowContent.label}</span>
      {rowContent.value && <span className="ml-auto min-w-0 truncate text-right text-muted-foreground">{rowContent.value}</span>}
    </Toggle>
    <Popover.Portal>
      <Popover.Positioner anchor={() => conditionPickerAnchor(triggerRef.current)} positionMethod="fixed" side="left" align="start" sideOffset={0} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="z-50">
        <Popover.Popup className="w-80 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
          <SectionHeader className="border-t-0 border-b">
            <span className="min-w-0 flex-1">{commandTypeLabels[command.type]}</span>
            <SectionHeaderActions><IconButtonTooltip label="Close command settings"><Button type="button" variant="ghost" size="icon-sm" aria-label="Close command settings" onClick={() => setOpen(false)}><X /></Button></IconButtonTooltip></SectionHeaderActions>
          </SectionHeader>
          <div className="space-y-3 p-3">
            <CommandFields game={game} mapId={mapId} command={command} conditionalDepth={conditionalDepth} conditionActions={conditionActions} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={onAutoOpenCommand} onCommandAdded={onCommandAdded} onChange={onChange} />
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}

function CommandsEditor({ game, mapId, value, onChange, conditionalDepth = 0, conditionActions, showAddControl = true, autoOpenCommand, onAutoOpenCommand, onCommandAdded }: { game: SourceGame; mapId: string; value: EventCommand[]; onChange: (value: EventCommand[]) => void; conditionalDepth?: number; conditionActions: ConditionActions; showAddControl?: boolean } & CommandAutoOpenProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropInsertionIndex, setDropInsertionIndex] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState<EventCommand[] | null>(null);
  const editorValue = draftValue || value;
  const changeValue = (nextValue: EventCommand[]) => {
    if (hasUnresolvedCommandReferences(game, nextValue)) {
      setDraftValue(nextValue);
      return;
    }
    setDraftValue(null);
    onChange(nextValue);
  };
  useEffect(() => {
    if (!draftValue || hasUnresolvedCommandReferences(game, draftValue)) return;
    setDraftValue(null);
    onChange(draftValue);
  }, [draftValue, game, onChange]);
  useEffect(() => setDraftValue(null), [value]);
  const update = (index: number, command: EventCommand) => changeValue(editorValue.map((item, itemIndex) => itemIndex === index ? command : item));
  const dropSeparator = (insertionIndex: number) => {
    const changesOrder = draggedIndex !== null && insertionIndex !== draggedIndex && insertionIndex !== draggedIndex + 1;
    return <div key={`drop-${insertionIndex}`} className="relative h-1">
      <div
        data-command-drop-position={insertionIndex}
        className="absolute -inset-y-1 inset-x-0 flex items-center"
        onDragOver={event => {
          event.stopPropagation();
          if (!changesOrder) {
            setDropInsertionIndex(null);
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropInsertionIndex(insertionIndex);
        }}
        onDrop={event => {
          event.stopPropagation();
          if (!changesOrder || draggedIndex === null) return;
          event.preventDefault();
          changeValue(moveToInsertionIndex(editorValue, draggedIndex, insertionIndex));
          setDraggedIndex(null);
          setDropInsertionIndex(null);
        }}
      ><div className={cn('h-px w-full bg-transparent transition-colors', changesOrder && dropInsertionIndex === insertionIndex && 'bg-primary')} aria-hidden="true" /></div>
    </div>;
  };
  return <div>
    {editorValue.map((command, index) => <Fragment key={index}>
      {dropSeparator(index)}
      <div className="space-y-2">
      <div
        data-command-row={index}
        className="relative flex min-w-0 items-center gap-1"
        onDragOver={() => setDropInsertionIndex(null)}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          draggable
          className="-ml-0.5 -mr-1 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label={`Reorder ${commandTypeLabels[command.type]} command`}
          onDragStart={event => {
            setDraggedIndex(index);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDropInsertionIndex(null);
          }}
          onKeyDown={event => {
            if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            event.preventDefault();
            changeValue(move(editorValue, index, event.key === 'ArrowUp' ? -1 : 1));
          }}
        ><GripVertical /></Button>
        <CommandSettings game={game} mapId={mapId} command={command} conditionalDepth={conditionalDepth} conditionActions={conditionActions} autoOpen={autoOpenCommand === command} onAutoOpen={onAutoOpenCommand} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={onAutoOpenCommand} onCommandAdded={onCommandAdded} onChange={next => update(index, next)} />
        <IconButtonTooltip label={`Remove ${command.type} command`}><Button type="button" variant="ghost" size="icon-sm" className="-mr-1 shrink-0" onClick={() => changeValue(editorValue.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${command.type} command`}><Minus /></Button></IconButtonTooltip>
      </div>
      {command.type === 'conditional' && <div className="ml-3 space-y-2">
        <div className="border-l-2 border-green-500/70 pl-2">
          <div data-slot="conditional-branch-header" className="flex h-8 items-center justify-between text-xs font-normal"><span>Then</span><div className="-mr-1"><AddCommandMenu game={game} conditionalDepth={conditionalDepth + 1} onAdd={nextCommand => { onCommandAdded?.(nextCommand); update(index, { ...command, thenCommands: [...command.thenCommands, nextCommand] }); }} /></div></div>
          <div><CommandsEditor game={game} mapId={mapId} value={command.thenCommands} conditionalDepth={conditionalDepth + 1} conditionActions={conditionActions} showAddControl={false} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={onAutoOpenCommand} onCommandAdded={onCommandAdded} onChange={thenCommands => update(index, { ...command, thenCommands })} /></div>
        </div>
        {command.elseCommands && <div className="border-l-2 border-red-500/70 pl-2">
          <div data-slot="conditional-branch-header" className="flex h-8 items-center justify-between text-xs font-normal"><span>Else</span><div className="-mr-1"><AddCommandMenu game={game} conditionalDepth={conditionalDepth + 1} onAdd={nextCommand => { onCommandAdded?.(nextCommand); update(index, { ...command, elseCommands: [...command.elseCommands!, nextCommand] }); }} /></div></div>
          <div><CommandsEditor game={game} mapId={mapId} value={command.elseCommands} conditionalDepth={conditionalDepth + 1} conditionActions={conditionActions} showAddControl={false} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={onAutoOpenCommand} onCommandAdded={onCommandAdded} onChange={elseCommands => update(index, { ...command, elseCommands })} /></div>
        </div>}
      </div>}
      </div>
    </Fragment>)}
    {editorValue.length > 0 && dropSeparator(editorValue.length)}
    {showAddControl && <div className="flex justify-end"><AddCommandMenu game={game} conditionalDepth={conditionalDepth} onAdd={command => { onCommandAdded?.(command); changeValue([...editorValue, command]); }} /></div>}
  </div>;
}

function defaultPage(): MapEventPage {
  return {
    movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
    options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
    priority: 'sameAsCharacters',
    trigger: { type: 'actionButton', radius: 1 },
    contents: [],
  };
}

export function EventInspector({ game, mapId, event, issues, assetUrls, sprites, onChangeEvent, onSelectPage, onImportSprite, onCreateSwitch, onCreateVariable, onRenameSwitch, onRenameVariable, onRenameItem }: Props) {
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const spritePickerAnchorRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [autoOpenSwitchConditionIndex, setAutoOpenSwitchConditionIndex] = useState<number | null>(null);
  const [autoOpenVariableConditionIndex, setAutoOpenVariableConditionIndex] = useState<number | null>(null);
  const [autoOpenCommand, setAutoOpenCommand] = useState<EventCommand | null>(null);
  const [draftContents, setDraftContents] = useState<EventCommand[] | null>(null);
  const [pendingSwitchCondition, setPendingSwitchCondition] = useState<Extract<Condition, { kind: 'switch' }> | null>(null);
  const [pendingVariableCondition, setPendingVariableCondition] = useState<Extract<Condition, { kind: 'variable' }> | null>(null);
  useEffect(() => {
    setPageIndex(0);
    setPendingSwitchCondition(null);
    setPendingVariableCondition(null);
    setAutoOpenSwitchConditionIndex(null);
    setAutoOpenVariableConditionIndex(null);
    setAutoOpenCommand(null);
    setDraftContents(null);
    onSelectPage?.(0);
  }, [event?.id, onSelectPage]);
  if (!event) return <div className="flex h-full flex-col"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Inspector</h2></div><div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">Select an event on the map or double-click a tile to create one.</div></div>;
  const selectedPageIndex = Math.min(pageIndex, event.pages.length - 1);
  const selectPage = (index: number) => {
    setPageIndex(index);
    setPendingSwitchCondition(null);
    setAutoOpenSwitchConditionIndex(null);
    setAutoOpenCommand(null);
    setDraftContents(null);
    onSelectPage?.(index);
  };
  const page = event.pages[selectedPageIndex];
  const updatePage = (nextPage: MapEventPage) => onChangeEvent({ ...event, pages: event.pages.map((item, index) => index === selectedPageIndex ? nextPage : item) });
  const addPage = () => {
    const pages = [...event.pages];
    pages.splice(selectedPageIndex + 1, 0, defaultPage());
    onChangeEvent({ ...event, pages });
    selectPage(selectedPageIndex + 1);
  };
  const duplicatePage = () => {
    const pages = [...event.pages];
    pages.splice(selectedPageIndex + 1, 0, structuredClone(page));
    onChangeEvent({ ...event, pages });
    selectPage(selectedPageIndex + 1);
  };
  const deletePage = () => {
    if (event.pages.length === 1) return;
    onChangeEvent({ ...event, pages: event.pages.filter((_, index) => index !== selectedPageIndex) });
    selectPage(Math.max(0, selectedPageIndex - 1));
  };
  const updateTriggerType = (type: MapEventPage['trigger']['type']) => updatePage({
    ...page,
    trigger: type === 'actionButton'
      ? { type, radius: 1 }
      : type === 'playerTouch' || type === 'eventTouch'
        ? { type, size: { w: 1, h: 1 } }
        : { type },
  });
  const touchTrigger = page.trigger.type === 'playerTouch' || page.trigger.type === 'eventTouch' ? page.trigger : null;
  const conditions = page.conditions || [];
  const editorConditions = [...conditions, ...(pendingSwitchCondition ? [pendingSwitchCondition] : []), ...(pendingVariableCondition ? [pendingVariableCondition] : [])];
  const changeConditions = (nextConditions: Condition[]) => {
    const nextPendingSwitch = nextConditions.find((condition): condition is Extract<Condition, { kind: 'switch' }> => condition.kind === 'switch' && !condition.id) || null;
    const nextPendingVariable = nextConditions.find((condition): condition is Extract<Condition, { kind: 'variable' }> => condition.kind === 'variable' && !condition.id) || null;
    const nextPersistedConditions = nextConditions.filter(condition => condition.kind === 'item' || Boolean(condition.id));
    const persistedConditionsChanged = nextPersistedConditions.length !== conditions.length || nextPersistedConditions.some((condition, index) => condition !== conditions[index]);
    setPendingSwitchCondition(nextPendingSwitch);
    setPendingVariableCondition(nextPendingVariable);
    if (persistedConditionsChanged) updatePage({ ...page, conditions: nextPersistedConditions.length ? nextPersistedConditions : undefined });
  };
  const autonomousMovementEnabled = page.movement.type !== 'fixed';
  return <div data-slot="event-inspector" className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
    <div className="shrink-0 border-b bg-sidebar px-3 py-2">
      <div className="mb-2 truncate text-xs font-semibold">{event.id}</div>
      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Event pages">
          {event.pages.map((_, index) => <Button key={index} type="button" role="tab" aria-selected={index === selectedPageIndex} variant={index === selectedPageIndex ? 'secondary' : 'ghost'} size="xs" onClick={() => selectPage(index)}>{index + 1}</Button>)}
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={addPage} aria-label="Add event page"><Plus /></Button>} />
          <TooltipContent>Add page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={duplicatePage} aria-label="Duplicate event page"><Copy /></Button>} />
          <TooltipContent>Duplicate page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={event.pages.length === 1} onClick={deletePage} aria-label="Delete event page"><Trash2 /></Button>} />
          <TooltipContent>Delete page</TooltipContent>
        </Tooltip>
      </div>
    </div>
    <ScrollArea className="min-h-0 flex-1"><div className="pb-8">
      {issues.length > 0 && <div className="mx-4 mt-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{issues.slice(0, 5).map(issue => <p key={`${issue.path}:${issue.message}`}>{issue.path}: {issue.message}</p>)}</div>}
      <Section first title="Conditions" actions={<AddConditionMenu game={game} onAdd={condition => {
        if (condition.kind === 'switch' && !Object.keys(game.initialState.switches).length) {
          if (!pendingSwitchCondition) setPendingSwitchCondition(condition);
          setAutoOpenSwitchConditionIndex(editorConditions.length);
          return;
        }
        if (condition.kind === 'variable' && !Object.keys(game.initialState.variables).length) {
          if (!pendingVariableCondition) setPendingVariableCondition(condition);
          setAutoOpenVariableConditionIndex(editorConditions.length);
          return;
        }
        const nextConditions = [...conditions, condition];
        updatePage({ ...page, conditions: nextConditions });
        setAutoOpenSwitchConditionIndex(condition.kind === 'switch' ? nextConditions.length - 1 : null);
        setAutoOpenVariableConditionIndex(condition.kind === 'variable' ? nextConditions.length - 1 : null);
      }} />}>
        {editorConditions.length > 0 ? <ConditionsEditor game={game} value={editorConditions} onChange={changeConditions} onCreateSwitch={onCreateSwitch} onCreateVariable={onCreateVariable} onRenameSwitch={onRenameSwitch} onRenameVariable={onRenameVariable} onRenameItem={onRenameItem} autoOpenSwitchIndex={autoOpenSwitchConditionIndex} autoOpenVariableIndex={autoOpenVariableConditionIndex} onAutoOpenSwitch={() => setAutoOpenSwitchConditionIndex(null)} onAutoOpenVariable={() => setAutoOpenVariableConditionIndex(null)} /> : null}
      </Section>
      <Section title="Trigger"><Tabs value={page.trigger.type} onValueChange={value => updateTriggerType(value as MapEventPage['trigger']['type'])}>
        <div className="grid gap-1.5">
          <label id="event-trigger-type-label" className={fieldLabelClassName}>Type</label>
          <TabsList className="w-full" aria-labelledby="event-trigger-type-label">
            {triggerTypes.map(({ type, label, icon: Icon }) => <IconButtonTooltip key={type} label={label}><TabsTrigger value={type} aria-label={label}><Icon /></TabsTrigger></IconButtonTooltip>)}
          </TabsList>
        </div>
        {page.trigger.type === 'actionButton' && <Field label="Radius"><NumberInput value={page.trigger.radius} min={0.25} step={0.25} onChange={radius => updatePage({ ...page, trigger: { type: 'actionButton', radius } })} /></Field>}
        {touchTrigger && <div className="grid grid-cols-2 gap-2"><Field label="Width"><NumberInput value={touchTrigger.size.w} min={0.5} step={0.5} onChange={w => updatePage({ ...page, trigger: { ...touchTrigger, size: { ...touchTrigger.size, w } } })} /></Field><Field label="Height"><NumberInput value={touchTrigger.size.h} min={0.5} step={0.5} onChange={h => updatePage({ ...page, trigger: { ...touchTrigger, size: { ...touchTrigger.size, h } } })} /></Field></div>}
      </Tabs>
      </Section>
      <Section title="Contents" actions={<AddCommandMenu game={game} onAdd={command => {
        setAutoOpenCommand(command);
        const nextContents = [...(draftContents || page.contents), command];
        if (hasUnresolvedCommandReferences(game, nextContents)) setDraftContents(nextContents);
        else updatePage({ ...page, contents: nextContents });
      }} />}><CommandsEditor game={game} mapId={mapId} value={draftContents || page.contents} conditionActions={{ onCreateSwitch, onCreateVariable, onRenameSwitch, onRenameVariable, onRenameItem }} showAddControl={false} autoOpenCommand={autoOpenCommand} onAutoOpenCommand={() => setAutoOpenCommand(null)} onCommandAdded={setAutoOpenCommand} onChange={contents => { setDraftContents(null); updatePage({ ...page, contents }); }} /></Section>
      <Section title="Sprite">
        <Popover.Root open={spritePickerOpen} onOpenChange={setSpritePickerOpen}>
          <Attachment ref={spritePickerAnchorRef} state={page.sprite ? 'done' : 'idle'} className="w-full">
            <Popover.Trigger render={<AttachmentTrigger aria-label={page.sprite ? 'Change sprite' : 'Choose a sprite'} />} />
            <AttachmentMedia variant={page.sprite ? 'image' : 'icon'}>
              {page.sprite
                ? <SpritePreview sprite={page.sprite} imageUrl={assetUrls[page.sprite.image] || sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.url} characterRows={sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.layout.characterRows} className="size-full" />
                : <ImageIcon />}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{page.sprite ? sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.name || page.sprite.image : 'Choose a sprite'}</AttachmentTitle>
              <AttachmentDescription>{page.sprite ? 'Click to choose another sprite.' : 'Browse the sprite library.'}</AttachmentDescription>
            </AttachmentContent>
            {page.sprite && <AttachmentActions><IconButtonTooltip label="Remove sprite"><AttachmentAction aria-label="Remove sprite" onClick={() => updatePage({ ...page, sprite: undefined })}><X /></AttachmentAction></IconButtonTooltip></AttachmentActions>}
          </Attachment>
          <EventSpritePicker open={spritePickerOpen} onOpenChange={setSpritePickerOpen} anchor={spritePickerAnchorRef} sprites={sprites} selected={page.sprite} onSelect={async (asset, characterIndex) => {
            await onImportSprite(asset);
            updatePage({ ...page, sprite: spriteReference(asset, characterIndex) });
          }} />
        </Popover.Root>
        {page.sprite && <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.walkingAnimation} onCheckedChange={walkingAnimation => updatePage({ ...page, options: { ...page.options, walkingAnimation } })} />Walking animation</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.steppingAnimation} onCheckedChange={steppingAnimation => updatePage({ ...page, options: { ...page.options, steppingAnimation } })} />Stepping animation</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.directionFix} onCheckedChange={directionFix => updatePage({ ...page, options: { ...page.options, directionFix } })} />Direction fix</label>
            <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.through} onCheckedChange={through => updatePage({ ...page, options: { ...page.options, through } })} />Through</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label id="event-priority-label" className={fieldLabelClassName}>Priority</label>
              <Tabs value={page.priority} onValueChange={priority => updatePage({ ...page, priority: priority as MapEventPage['priority'] })}>
                <TabsList className="w-full" aria-labelledby="event-priority-label">
                  {priorityTypes.map(({ type, label, icon: Icon }) => <IconButtonTooltip key={type} label={label}><TabsTrigger value={type} aria-label={label}><Icon /></TabsTrigger></IconButtonTooltip>)}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </>}
      </Section>
      <Section title="Autonomous Movement" actions={<Switch size="sm" checked={autonomousMovementEnabled} onCheckedChange={enabled => updatePage({ ...page, movement: { ...page.movement, type: enabled ? 'random' : 'fixed' } })} aria-label="Enable autonomous movement" />}>
        {autonomousMovementEnabled && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <EnumSelect value={page.movement.type} values={['random', 'approach', 'custom'] as const} labels={{ random: 'Random', approach: 'Approach player', custom: 'Custom route' }} ariaLabel="Autonomous movement type" onChange={type => updatePage({ ...page, movement: { ...page.movement, type } })} />
          <AutonomousMovementSettings movement={page.movement} onChange={movement => updatePage({ ...page, movement })} />
        </div>}
      </Section>
    </div></ScrollArea>
  </div>;
}
