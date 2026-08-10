import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { CommonEvent, Item, Skill, SourceGame, TypeCategory, TypeDefinition } from '@rpgcrafter/game-schema';
import { Copy, Database, Images, Package, Plus, Search, Tags, ToggleLeft, Trash2, Variable, WandSparkles, Workflow, X } from 'lucide-react';
import { EventCommandsEditor, SwitchPicker } from '@/components/event-inspector';
import { ProjectTilesetManager, type ProjectTilesetManagerProps } from '@/components/asset-manager-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { findDatabaseReferences, type DatabaseEntryKind, type DatabaseReference } from '@/lib/database-references';

type DatabaseSection = 'tilesets' | 'items' | 'skills' | 'commonEvents' | 'types' | 'variables' | 'switches';
type DeletableDatabaseEntryKind = Extract<DatabaseEntryKind, 'item' | 'skill' | 'commonEvent'>;
type PendingDelete = { kind: DeletableDatabaseEntryKind; id: string; name: string; references: DatabaseReference[] };
type DatabaseListEntry = { name: string; type?: string; initialValue?: boolean | number };

export type DatabaseManagerProps = {
  game: SourceGame;
  onCreateItem: (name: string, type: Item['type']) => string;
  onUpdateItem: (id: string, item: Item) => void;
  onDuplicateItem: (id: string) => string;
  onDeleteItem: (id: string) => void;
  onCreateSkill: (name: string, type: Skill['type']) => string;
  onUpdateSkill: (id: string, skill: Skill) => void;
  onDuplicateSkill: (id: string) => string;
  onDeleteSkill: (id: string) => void;
  onCreateCommonEvent: (name: string) => string;
  onUpdateCommonEvent: (id: string, commonEvent: CommonEvent) => void;
  onDuplicateCommonEvent: (id: string) => string;
  onDeleteCommonEvent: (id: string) => void;
  onCreateType: (category: TypeCategory, name: string) => number;
  onRenameType: (category: TypeCategory, id: number, name: string) => void;
  onDeleteType: (category: TypeCategory, id: number) => void;
  onRenameVariable: (id: string, name: string) => void;
  onRenameSwitch: (id: string, name: string) => void;
  onCreateSwitch: (name: string) => string;
  onCreateVariable: (name: string) => string;
} & Omit<ProjectTilesetManagerProps, 'game'>;

const sectionLabels: Record<DatabaseSection, string> = { tilesets: 'Tilesets', items: 'Items', skills: 'Skills', commonEvents: 'Common Events', types: 'Types', variables: 'Variables', switches: 'Switches' };
const typeCategoryLabels: Record<TypeCategory, string> = { elements: 'Elements', skills: 'Skill Types', weapons: 'Weapon Types', armors: 'Armor Types', equipment: 'Equipment Types' };
const typeCategories = Object.keys(typeCategoryLabels) as TypeCategory[];

function getSectionEntries(game: SourceGame, section: DatabaseSection): Record<string, DatabaseListEntry> {
  if (section === 'tilesets') return game.tilesets;
  if (section === 'items') return game.items;
  if (section === 'skills') return game.skills;
  if (section === 'commonEvents') return game.events.commonEvents;
  if (section === 'variables') return game.initialState.variables;
  if (section === 'types') return {};
  return game.initialState.switches;
}

function sectionCount(game: SourceGame, section: DatabaseSection) {
  return section === 'types' ? typeCategories.reduce((count, category) => count + game.types[category].entries.length, 0) : Object.keys(getSectionEntries(game, section)).length;
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}{description && <p className="text-[10px] leading-4 text-muted-foreground">{description}</p>}</div>;
}

function BufferedTextInput({ value, onCommit, ariaLabel }: { value: string; onCommit: (value: string) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next) onCommit(next); else setDraft(value);
  };
  return <Input aria-label={ariaLabel} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

function BufferedNumberInput({ value, onCommit, ariaLabel, min = 0 }: { value: number; onCommit: (value: number) => void; ariaLabel: string; min?: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next) && next >= min) onCommit(next); else setDraft(String(value));
  };
  return <Input type="number" aria-label={ariaLabel} min={min} step="any" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

function TypeSelect<T extends string>({ value, values, labels, ariaLabel, onChange }: { value: T; values: readonly T[]; labels: Record<T, string>; ariaLabel: string; onChange: (value: T) => void }) {
  return <Select value={value} onValueChange={next => onChange(next as T)}><SelectTrigger className="w-full" aria-label={ariaLabel}><SelectValue>{labels[value]}</SelectValue></SelectTrigger><SelectContent>{values.map(option => <SelectItem key={option} value={option}>{labels[option]}</SelectItem>)}</SelectContent></Select>;
}

function ItemForm({ id, item, game, onChange }: { id: string; item: Item; game: SourceGame; onChange: (item: Item) => void }) {
  const equipmentTypes = game.types.equipment.entries;
  const changeType = (type: Item['type']) => {
    if (type === 'quest') onChange({ name: item.name, type });
    if (type === 'consumable') onChange({ name: item.name, type, healing: 0 });
    if (type === 'equipment') onChange({ name: item.name, type, equipmentTypeId: equipmentTypes[0]?.id, stats: {} });
  };
  const stats = Object.entries(item.stats || {});
  const renameStat = (previousKey: string, requestedKey: string) => {
    const key = requestedKey.trim();
    if (!key || key !== previousKey && key in (item.stats || {})) return;
    const nextStats = Object.fromEntries(stats.map(([name, value]) => [name === previousKey ? key : name, value]));
    onChange({ ...item, stats: nextStats });
  };
  const addStat = () => {
    const used = new Set(Object.keys(item.stats || {}));
    let key = 'stat', suffix = 2;
    while (used.has(key)) key = `stat-${suffix++}`;
    onChange({ ...item, stats: { ...item.stats, [key]: 0 } });
  };
  return <EditorForm title={item.name} id={id} icon={<Package />}>
    <Field label="Name"><BufferedTextInput value={item.name} ariaLabel="Item name" onCommit={name => onChange({ ...item, name })} /></Field>
    <Field label="Type"><TypeSelect value={item.type} values={['quest', 'consumable', 'equipment']} labels={{ quest: 'Quest', consumable: 'Consumable', equipment: 'Equipment' }} ariaLabel="Item type" onChange={changeType} /></Field>
    {item.type === 'consumable' && <Field label="Healing" description="Health restored when the item is used."><BufferedNumberInput value={item.healing ?? 0} ariaLabel="Item healing" onCommit={healing => onChange({ ...item, healing })} /></Field>}
    {item.type === 'equipment' && <>
      <Field label="Equipment type" description={equipmentTypes.length ? 'The type this item can be equipped into.' : 'No equipment types are configured for this project yet.'}>
        {equipmentTypes.length ? <TypeSelect value={String(item.equipmentTypeId && equipmentTypes.some(type => type.id === item.equipmentTypeId) ? item.equipmentTypeId : equipmentTypes[0].id)} values={equipmentTypes.map(type => String(type.id))} labels={Object.fromEntries(equipmentTypes.map(type => [String(type.id), type.name]))} ariaLabel="Equipment type" onChange={equipmentTypeId => onChange({ ...item, equipmentTypeId: Number(equipmentTypeId) })} /> : <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Add an Equipment Type in the Types section before assigning this item.</div>}
      </Field>
      <Field label="Stats" description="The Player currently recognizes attack and defense. Other finite values remain available to game data.">
        <div className="grid gap-2">
          {stats.map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_120px_28px] gap-2"><Input aria-label={`Stat name ${key}`} defaultValue={key} onBlur={event => renameStat(key, event.currentTarget.value)} /><BufferedNumberInput value={value} min={-Number.MAX_VALUE} ariaLabel={`Stat value ${key}`} onCommit={nextValue => onChange({ ...item, stats: { ...item.stats, [key]: nextValue } })} /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove stat ${key}`} onClick={() => onChange({ ...item, stats: Object.fromEntries(stats.filter(([name]) => name !== key)) })}><X /></Button></div>)}
          {!stats.length && <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No stat modifiers.</div>}
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={addStat}><Plus />Add stat</Button>
        </div>
      </Field>
    </>}
  </EditorForm>;
}

function SkillForm({ id, skill, onChange }: { id: string; skill: Skill; onChange: (skill: Skill) => void }) {
  const pickerColor = /^#[0-9a-f]{6}$/i.test(skill.color || '') ? skill.color! : '#ffffff';
  const changeType = (type: Skill['type']) => {
    const common = { name: skill.name, type, damage: skill.damage, cooldown: skill.cooldown };
    if (type === 'melee') onChange({ ...common, type, range: 1 });
    if (type === 'projectile') onChange({ ...common, type, projectileSpeed: 300, color: '#ffffff' });
    if (type === 'area') onChange({ ...common, type, range: 1, color: '#ffffff' });
  };
  return <EditorForm title={skill.name} id={id} icon={<WandSparkles />}>
    <Field label="Name"><BufferedTextInput value={skill.name} ariaLabel="Skill name" onCommit={name => onChange({ ...skill, name })} /></Field>
    <Field label="Type"><TypeSelect value={skill.type} values={['melee', 'projectile', 'area']} labels={{ melee: 'Melee', projectile: 'Projectile', area: 'Area' }} ariaLabel="Skill type" onChange={changeType} /></Field>
    <div className="grid grid-cols-2 gap-4"><Field label="Damage"><BufferedNumberInput value={skill.damage} ariaLabel="Skill damage" onCommit={damage => onChange({ ...skill, damage })} /></Field><Field label="Cooldown" description="Seconds between uses."><BufferedNumberInput value={skill.cooldown} ariaLabel="Skill cooldown" onCommit={cooldown => onChange({ ...skill, cooldown })} /></Field></div>
    {(skill.type === 'melee' || skill.type === 'area') && <Field label="Range"><BufferedNumberInput value={skill.range ?? 1} ariaLabel="Skill range" onCommit={range => onChange({ ...skill, range })} /></Field>}
    {skill.type === 'projectile' && <Field label="Projectile speed"><BufferedNumberInput value={skill.projectileSpeed ?? 300} ariaLabel="Projectile speed" onCommit={projectileSpeed => onChange({ ...skill, projectileSpeed })} /></Field>}
    {(skill.type === 'projectile' || skill.type === 'area') && <Field label="Color"><div className="flex gap-2"><Input type="color" className="w-12 px-1" aria-label="Skill color picker" value={pickerColor} onChange={event => onChange({ ...skill, color: event.target.value })} /><BufferedTextInput value={skill.color || '#ffffff'} ariaLabel="Skill color" onCommit={color => onChange({ ...skill, color })} /></div></Field>}
  </EditorForm>;
}

function CommonEventForm({ id, commonEvent, game, onChange, onCreateSwitch, onCreateVariable }: { id: string; commonEvent: CommonEvent; game: SourceGame; onChange: (commonEvent: CommonEvent) => void; onCreateSwitch: (name: string) => string; onCreateVariable: (name: string) => string }) {
  const [pendingTriggerType, setPendingTriggerType] = useState<'autorun' | 'parallel' | null>(null);
  const [autoOpenTriggerSwitch, setAutoOpenTriggerSwitch] = useState(false);
  useEffect(() => { setPendingTriggerType(null); setAutoOpenTriggerSwitch(false); }, [id]);
  const triggerType = pendingTriggerType || commonEvent.trigger.type;
  const switchId = commonEvent.trigger.type === 'none' ? '' : commonEvent.trigger.switchId;
  const changeTrigger = (type: CommonEvent['trigger']['type']) => {
    if (type === 'none') {
      setPendingTriggerType(null);
      onChange({ ...commonEvent, trigger: { type } });
      return;
    }
    const nextSwitchId = switchId || Object.keys(game.initialState.switches)[0] || '';
    if (!nextSwitchId) {
      setPendingTriggerType(type);
      setAutoOpenTriggerSwitch(true);
      return;
    }
    setPendingTriggerType(null);
    onChange({ ...commonEvent, trigger: { type, switchId: nextSwitchId } });
  };
  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto grid max-w-2xl gap-5 p-8 pb-4">
      <div className="flex items-center gap-3 border-b pb-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Workflow className="size-5" /></div><div className="min-w-0"><h2 className="truncate text-base font-semibold">{commonEvent.name}</h2><p className="font-mono text-[10px] text-muted-foreground">{id}</p></div></div>
      <Field label="Name"><BufferedTextInput value={commonEvent.name} ariaLabel="Common event name" onCommit={name => onChange({ ...commonEvent, name })} /></Field>
      <Field label="Trigger"><TypeSelect value={triggerType} values={['none', 'autorun', 'parallel']} labels={{ none: 'None', autorun: 'Autorun', parallel: 'Parallel' }} ariaLabel="Common event trigger" onChange={changeTrigger} /></Field>
      {triggerType !== 'none' && <Field label="Switch"><SwitchPicker game={game} value={switchId} onChange={nextSwitchId => { setPendingTriggerType(null); onChange({ ...commonEvent, trigger: { type: triggerType, switchId: nextSwitchId } }); }} onCreate={onCreateSwitch} autoOpen={autoOpenTriggerSwitch} onAutoOpen={() => setAutoOpenTriggerSwitch(false)} showIcon={false} showValue={false} anchorToInspector={false} /></Field>}
    </div>
    <div className="mx-auto max-w-2xl pb-8"><EventCommandsEditor key={id} game={game} value={commonEvent.contents} onChange={contents => onChange({ ...commonEvent, contents })} onCreateSwitch={onCreateSwitch} onCreateVariable={onCreateVariable} allowMapEventTargets={false} /></div>
  </div>;
}

function EditorForm({ title, id, icon, children }: { title: string; id: string; icon: ReactNode; children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto grid max-w-2xl gap-6 p-8"><div className="flex items-center gap-3 border-b pb-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-5">{icon}</div><div className="min-w-0"><h2 className="truncate text-base font-semibold">{title}</h2><p className="font-mono text-[10px] text-muted-foreground">{id}</p></div></div><div className="grid gap-5">{children}</div></div></div>;
}

function ReferenceList({ references }: { references: DatabaseReference[] }) {
  return <Field label="Usages" description={references.length ? `${references.length} reference${references.length === 1 ? '' : 's'} found in the project.` : 'This entry is not currently used.'}>
    {references.length ? <div className="rounded-md border">{references.map((reference, index) => <div key={`${reference.path}:${index}`} className="border-b px-3 py-2.5 last:border-b-0"><div className="text-xs font-medium">{reference.label}</div><div className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{reference.path}</div></div>)}</div> : <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">No usages found.</div>}
  </Field>;
}

function SystemEntryForm({ id, kind, game, onRename }: { id: string; kind: 'variable' | 'switch'; game: SourceGame; onRename: (name: string) => void }) {
  const definition = kind === 'variable' ? game.initialState.variables[id] : game.initialState.switches[id];
  const references = useMemo(() => findDatabaseReferences(game, kind, id), [game, id, kind]);
  const initialValue = definition.initialValue;
  return <EditorForm title={definition.name} id={id} icon={kind === 'variable' ? <Variable /> : <ToggleLeft />}>
    <Field label="Name"><BufferedTextInput value={definition.name} ariaLabel={`${kind === 'variable' ? 'Variable' : 'Switch'} name`} onCommit={onRename} /></Field>
    <Field label="Initial value" description="The initial value is shown for reference and cannot be changed here yet."><Input aria-label={`${kind === 'variable' ? 'Variable' : 'Switch'} initial value`} value={String(initialValue)} readOnly /></Field>
    <ReferenceList references={references} />
  </EditorForm>;
}

function TypesSection({ game, onCreateType, onRenameType, onDeleteType }: Pick<DatabaseManagerProps, 'game' | 'onCreateType' | 'onRenameType' | 'onDeleteType'>) {
  const [category, setCategory] = useState<TypeCategory>('elements');
  const [selectedIds, setSelectedIds] = useState<Partial<Record<TypeCategory, number>>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ entry: TypeDefinition; references: DatabaseReference[] } | null>(null);
  const catalog = game.types[category];
  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const id = onCreateType(category, name);
    setSelectedIds(current => ({ ...current, [category]: id }));
    setCreateOpen(false);
    setNewName('');
  };
  const requestDelete = (entry: TypeDefinition) => {
    const references = category === 'equipment' ? findDatabaseReferences(game, 'equipmentType', String(entry.id)) : [];
    setPendingDelete({ entry, references });
  };
  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.references.length) return;
    onDeleteType(category, pendingDelete.entry.id);
    setPendingDelete(null);
  };
  return <>
    <SidebarProvider className="min-h-0 w-auto" style={{ '--sidebar-width': '384px' } as CSSProperties}>
      <Sidebar collapsible="none" className="border-r" data-database-sidebar="type-categories">
        <SidebarHeader className="border-b"><div className="flex h-8 items-center text-xs font-semibold">Type categories</div></SidebarHeader>
        <SidebarContent><SidebarGroup><SidebarGroupContent><SidebarMenu role="list" aria-label="Type categories">
          {typeCategories.map(typeCategory => <SidebarMenuItem key={typeCategory} role="listitem"><SidebarMenuButton isActive={category === typeCategory} aria-current={category === typeCategory ? 'true' : undefined} onClick={() => setCategory(typeCategory)}><span className="truncate">{typeCategoryLabels[typeCategory]}</span></SidebarMenuButton><SidebarMenuBadge>{game.types[typeCategory].entries.length}</SidebarMenuBadge></SidebarMenuItem>)}
        </SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      </Sidebar>
    </SidebarProvider>
    <section className="flex min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4"><div><h2 className="text-sm font-semibold">{typeCategoryLabels[category]}</h2><p className="text-[10px] text-muted-foreground">IDs are assigned automatically and remain stable.</p></div><Button type="button" size="sm" aria-label={`Create ${typeCategoryLabels[category]}`} onClick={() => setCreateOpen(true)}><Plus />Add type</Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {catalog.entries.length ? <div className="mx-auto max-w-2xl"><Table aria-label={typeCategoryLabels[category]}>
          <TableHeader><TableRow><TableHead className="w-24">ID</TableHead><TableHead>Name</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>{catalog.entries.map(entry => {
            const selected = selectedIds[category] === entry.id;
            return <TableRow key={entry.id} data-state={selected ? 'selected' : undefined} onClick={() => setSelectedIds(current => ({ ...current, [category]: entry.id }))}>
              <TableCell className="font-mono tabular-nums">{entry.id}</TableCell>
              <TableCell><BufferedTextInput value={entry.name} ariaLabel={`${typeCategoryLabels[category]} name ${entry.id}`} onCommit={name => onRenameType(category, entry.id, name)} /></TableCell>
              <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${entry.name}`} onClick={() => requestDelete(entry)}><Trash2 /></Button></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table></div> : <div className="grid h-full place-items-center text-center"><div><Tags className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="text-sm font-semibold">No {typeCategoryLabels[category].toLocaleLowerCase()} yet</h2><p className="mt-1 text-xs text-muted-foreground">Add a type to start building this category.</p><Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus />Add type</Button></div></div>}
      </div>
    </section>

    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setNewName(''); }}><DialogContent><DialogHeader><DialogTitle>Create {typeCategoryLabels[category].replace(/s$/, '')}</DialogTitle><DialogDescription>The numeric ID is assigned automatically and will not be reused.</DialogDescription></DialogHeader><Field label="Name"><Input autoFocus aria-label="New type name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} /></Field><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!newName.trim()} onClick={create}>Create</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}><AlertDialogContent className={pendingDelete?.references.length ? 'max-w-lg sm:max-w-lg' : undefined}><AlertDialogHeader><AlertDialogTitle>{pendingDelete?.references.length ? `Cannot delete ${pendingDelete.entry.name}` : `Delete ${pendingDelete?.entry.name}?`}</AlertDialogTitle><AlertDialogDescription>{pendingDelete?.references.length ? 'This type is still used by the game. Remove these references before deleting it.' : 'This removes the type from the project database. Its numeric ID will not be reused.'}</AlertDialogDescription></AlertDialogHeader>{Boolean(pendingDelete?.references.length) && <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-2">{pendingDelete!.references.map((reference, index) => <div key={`${reference.path}:${index}`} className="border-b px-2 py-2 last:border-b-0"><div className="text-xs font-medium">{reference.label}</div><div className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{reference.path}</div></div>)}</div>}<AlertDialogFooter>{pendingDelete?.references.length ? <AlertDialogCancel>Close</AlertDialogCancel> : <><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction></>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

export function DatabaseManager(props: DatabaseManagerProps) {
  const { game } = props;
  const [section, setSection] = useState<DatabaseSection>('items');
  const [queries, setQueries] = useState<Record<DatabaseSection, string>>({ tilesets: '', items: '', skills: '', commonEvents: '', types: '', variables: '', switches: '' });
  const [selectedIds, setSelectedIds] = useState<Record<DatabaseSection, string>>({ tilesets: Object.keys(game.tilesets)[0] || '', items: Object.keys(game.items)[0] || '', skills: Object.keys(game.skills)[0] || '', commonEvents: Object.keys(game.events.commonEvents)[0] || '', types: '', variables: Object.keys(game.initialState.variables)[0] || '', switches: Object.keys(game.initialState.switches)[0] || '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newItemType, setNewItemType] = useState<Item['type']>('consumable');
  const [newSkillType, setNewSkillType] = useState<Skill['type']>('melee');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const entries = getSectionEntries(game, section);
  const query = queries[section];
  const visibleEntries = useMemo(() => Object.entries(entries).filter(([id, entry]) => `${entry.name} ${id} ${entry.type || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => a[1].name.localeCompare(b[1].name)), [entries, query]);
  const selectedId = selectedIds[section];
  const selected = entries[selectedId];

  useEffect(() => {
    setSelectedIds(current => {
      const next = { ...current };
      if (!game.tilesets[next.tilesets]) next.tilesets = Object.keys(game.tilesets)[0] || '';
      if (!game.items[next.items]) next.items = Object.keys(game.items)[0] || '';
      if (!game.skills[next.skills]) next.skills = Object.keys(game.skills)[0] || '';
      if (!game.events.commonEvents[next.commonEvents]) next.commonEvents = Object.keys(game.events.commonEvents)[0] || '';
      if (!game.initialState.variables[next.variables]) next.variables = Object.keys(game.initialState.variables)[0] || '';
      if (!game.initialState.switches[next.switches]) next.switches = Object.keys(game.initialState.switches)[0] || '';
      return next.tilesets === current.tilesets && next.items === current.items && next.skills === current.skills && next.commonEvents === current.commonEvents && next.variables === current.variables && next.switches === current.switches ? current : next;
    });
  }, [game.events.commonEvents, game.initialState.switches, game.initialState.variables, game.items, game.skills, game.tilesets]);

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    if (section !== 'items' && section !== 'skills' && section !== 'commonEvents') return;
    const id = section === 'items' ? props.onCreateItem(name, newItemType) : section === 'skills' ? props.onCreateSkill(name, newSkillType) : props.onCreateCommonEvent(name);
    setSelectedIds(current => ({ ...current, [section]: id }));
    setCreateOpen(false);
    setNewName('');
  };
  const duplicate = () => {
    if (!selectedId || section !== 'items' && section !== 'skills' && section !== 'commonEvents') return;
    const id = section === 'items' ? props.onDuplicateItem(selectedId) : section === 'skills' ? props.onDuplicateSkill(selectedId) : props.onDuplicateCommonEvent(selectedId);
    setSelectedIds(current => ({ ...current, [section]: id }));
  };
  const requestDelete = () => {
    if (!selected || section !== 'items' && section !== 'skills' && section !== 'commonEvents') return;
    const kind = section === 'items' ? 'item' : section === 'skills' ? 'skill' : 'commonEvent';
    setPendingDelete({ kind, id: selectedId, name: selected.name, references: findDatabaseReferences(game, kind, selectedId) });
  };
  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.references.length) return;
    if (pendingDelete.kind === 'item') props.onDeleteItem(pendingDelete.id); else if (pendingDelete.kind === 'skill') props.onDeleteSkill(pendingDelete.id); else props.onDeleteCommonEvent(pendingDelete.id);
    setPendingDelete(null);
  };

  return <div className="flex size-full min-h-0 flex-col" data-slot="database-manager">
    <div className="grid min-h-0 flex-1 grid-cols-[240px_384px_minmax(0,1fr)]">
      <SidebarProvider className="min-h-0 w-auto" style={{ '--sidebar-width': '240px' } as CSSProperties}>
        <Sidebar collapsible="none" className="border-r" data-database-sidebar="sections">
          <SidebarContent><nav aria-label="Database sections">
            {([{ label: 'Game', sections: ['items', 'skills', 'commonEvents'] }, { label: 'System', sections: ['tilesets', 'types', 'variables', 'switches'] }] as const).map(group => <SidebarGroup key={group.label}><SidebarGroupLabel>{group.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
              {group.sections.map(menuSection => {
                const active = section === menuSection;
                const count = sectionCount(game, menuSection);
                const Icon = menuSection === 'tilesets' ? Images : menuSection === 'items' ? Package : menuSection === 'skills' ? WandSparkles : menuSection === 'commonEvents' ? Workflow : menuSection === 'types' ? Tags : menuSection === 'variables' ? Variable : ToggleLeft;
                return <SidebarMenuItem key={menuSection}><SidebarMenuButton isActive={active} aria-current={active ? 'page' : undefined} onClick={() => setSection(menuSection)}><Icon /><span>{sectionLabels[menuSection]}</span></SidebarMenuButton><SidebarMenuBadge>{count}</SidebarMenuBadge></SidebarMenuItem>;
              })}
            </SidebarMenu></SidebarGroupContent></SidebarGroup>)}
          </nav></SidebarContent>
        </Sidebar>
      </SidebarProvider>
      {section === 'tilesets' ? <div className="col-span-2 min-h-0"><ProjectTilesetManager game={game} assetUrls={props.assetUrls} onImportLocal={props.onImportLocal} onUpdate={props.onUpdate} onChangeTerrainCollision={props.onChangeTerrainCollision} /></div> : section === 'types' ? <TypesSection game={game} onCreateType={props.onCreateType} onRenameType={props.onRenameType} onDeleteType={props.onDeleteType} /> : <><SidebarProvider className="min-h-0 w-auto" style={{ '--sidebar-width': '384px' } as CSSProperties}>
        <Sidebar collapsible="none" className="border-r" data-database-sidebar="entries">
          <SidebarHeader className="border-b"><div className="flex h-8 items-center gap-2"><span className="min-w-0 flex-1 text-xs font-semibold">{sectionLabels[section]}</span>{(section === 'items' || section === 'skills' || section === 'commonEvents') && <Button type="button" size="icon-sm" aria-label={`Create ${section === 'items' ? 'item' : section === 'skills' ? 'skill' : 'common event'}`} onClick={() => setCreateOpen(true)}><Plus /></Button>}</div><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" /><SidebarInput type="search" className="pl-7" aria-label={`Search ${section}`} placeholder={`Search ${section}…`} value={query} onChange={event => setQueries(current => ({ ...current, [section]: event.target.value }))} /></div></SidebarHeader>
          <SidebarContent>{visibleEntries.length ? <SidebarGroup><SidebarGroupContent><SidebarMenu role="list" aria-label={sectionLabels[section]}>{visibleEntries.map(([id, entry]) => <SidebarMenuItem key={id} role="listitem"><SidebarMenuButton isActive={id === selectedId} aria-current={id === selectedId ? 'true' : undefined} onClick={() => setSelectedIds(current => ({ ...current, [section]: id }))}><span className="truncate">{entry.name}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup> : <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-xs text-muted-foreground">{query ? `No ${section} match your search.` : `No ${section} yet.`}</div>}</SidebarContent>
        </Sidebar>
      </SidebarProvider>
      <section className="flex min-h-0 flex-col bg-background">
        {selected ? <>
          {(section === 'items' || section === 'skills' || section === 'commonEvents') && <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b px-4"><Button type="button" variant="outline" size="sm" onClick={duplicate}><Copy />Duplicate</Button><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={requestDelete}><Trash2 />Delete</Button></div>}
          {section === 'items' ? <ItemForm id={selectedId} item={selected as Item} game={game} onChange={item => props.onUpdateItem(selectedId, item)} /> : section === 'skills' ? <SkillForm id={selectedId} skill={selected as Skill} onChange={skill => props.onUpdateSkill(selectedId, skill)} /> : section === 'commonEvents' ? <CommonEventForm id={selectedId} commonEvent={selected as CommonEvent} game={game} onChange={commonEvent => props.onUpdateCommonEvent(selectedId, commonEvent)} onCreateSwitch={props.onCreateSwitch} onCreateVariable={props.onCreateVariable} /> : <SystemEntryForm id={selectedId} kind={section === 'variables' ? 'variable' : 'switch'} game={game} onRename={name => section === 'variables' ? props.onRenameVariable(selectedId, name) : props.onRenameSwitch(selectedId, name)} />}
        </> : <div className="grid size-full place-items-center p-8 text-center"><div><Database className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="text-sm font-semibold">No {section} to edit</h2><p className="mt-1 text-xs text-muted-foreground">{section === 'items' || section === 'skills' || section === 'commonEvents' ? 'Create one to start building your game database.' : `No ${section} are configured for this project.`}</p>{(section === 'items' || section === 'skills' || section === 'commonEvents') && <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus />Create {section === 'items' ? 'item' : section === 'skills' ? 'skill' : 'common event'}</Button>}</div></div>}
      </section>
      </>}
    </div>

    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setNewName(''); }}><DialogContent><DialogHeader><DialogTitle>Create {section === 'items' ? 'item' : section === 'skills' ? 'skill' : 'common event'}</DialogTitle><DialogDescription>The technical ID is generated from the name and remains stable.</DialogDescription></DialogHeader><div className="grid gap-4"><Field label="Name"><Input autoFocus aria-label="New entry name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} /></Field>{section !== 'commonEvents' && <Field label="Type">{section === 'items' ? <TypeSelect value={newItemType} values={['quest', 'consumable', 'equipment']} labels={{ quest: 'Quest', consumable: 'Consumable', equipment: 'Equipment' }} ariaLabel="New item type" onChange={setNewItemType} /> : <TypeSelect value={newSkillType} values={['melee', 'projectile', 'area']} labels={{ melee: 'Melee', projectile: 'Projectile', area: 'Area' }} ariaLabel="New skill type" onChange={setNewSkillType} />}</Field>}</div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!newName.trim()} onClick={create}>Create</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}><AlertDialogContent className={pendingDelete?.references.length ? 'max-w-lg sm:max-w-lg' : undefined}><AlertDialogHeader><AlertDialogTitle>{pendingDelete?.references.length ? `Cannot delete ${pendingDelete.name}` : `Delete ${pendingDelete?.name}?`}</AlertDialogTitle><AlertDialogDescription>{pendingDelete?.references.length ? 'This entry is still used by the game. Remove these references before deleting it.' : 'This removes the entry from the project database. This action cannot be undone.'}</AlertDialogDescription></AlertDialogHeader>{Boolean(pendingDelete?.references.length) && <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-2">{pendingDelete!.references.map((reference, index) => <div key={`${reference.path}:${index}`} className="border-b px-2 py-2 last:border-b-0"><div className="text-xs font-medium">{reference.label}</div><div className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{reference.path}</div></div>)}</div>}<AlertDialogFooter>{pendingDelete?.references.length ? <AlertDialogCancel>Close</AlertDialogCancel> : <><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction></>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
