import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { BattleBackground, CommonEvent, EnemyTemplate, Item, Skill, SourceGame, Troop, TypeCategory, TypeDefinition } from '@rpgcrafter/game-schema';
import { ChevronRight, Copy, Database, ImageIcon, Images, Package, Play, Plus, Search, Settings, Shield, Swords, Tags, ToggleLeft, Trash2, Variable, WandSparkles, Workflow, X } from 'lucide-react';
import { EventCommandsEditor, SwitchPicker } from '@/components/event-inspector';
import { ProjectTilesetManager, type LibraryBattleAsset, type ProjectTilesetManagerProps } from '@/components/asset-manager-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider } from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toggle } from '@/components/ui/toggle';
import { findDatabaseReferences, type DatabaseEntryKind, type DatabaseReference } from '@/lib/database-references';
import { cn } from '@/lib/utils';

type DatabaseSection = 'tilesets' | 'items' | 'skills' | 'enemies' | 'troops' | 'commonEvents' | 'system' | 'types' | 'variables' | 'switches';
type DeletableDatabaseEntryKind = Extract<DatabaseEntryKind, 'item' | 'skill' | 'enemy' | 'troop' | 'commonEvent'>;
type PendingDelete = { kind: DeletableDatabaseEntryKind; id: number; name: string; references: DatabaseReference[] };
type DatabaseListEntry = { name: string; type?: string; initialValue?: boolean | number };

export type DatabaseManagerProps = {
  game: SourceGame;
  onCreateItem: (name: string, type: Item['type']) => number;
  onUpdateItem: (id: number, item: Item) => void;
  onDuplicateItem: (id: number) => number;
  onDeleteItem: (id: number) => void;
  onCreateSkill: (name: string, type: Skill['type']) => number;
  onUpdateSkill: (id: number, skill: Skill) => void;
  onDuplicateSkill: (id: number) => number;
  onDeleteSkill: (id: number) => void;
  battleAssets: LibraryBattleAsset[];
  onImportBattleAsset: (asset: LibraryBattleAsset) => Promise<void>;
  onCreateEnemy: (name: string) => number;
  onUpdateEnemy: (id: number, enemy: EnemyTemplate) => void;
  onDuplicateEnemy: (id: number) => number;
  onDeleteEnemy: (id: number) => void;
  onCreateTroop: (name: string) => number;
  onUpdateTroop: (id: number, troop: Troop) => void;
  onDuplicateTroop: (id: number) => number;
  onDeleteTroop: (id: number) => void;
  onBattleTest: (id: number) => void;
  onUpdateDefaultBattleBackground: (background?: BattleBackground) => void;
  onCreateCommonEvent: (name: string) => number;
  onUpdateCommonEvent: (id: number, commonEvent: CommonEvent) => void;
  onDuplicateCommonEvent: (id: number) => number;
  onDeleteCommonEvent: (id: number) => void;
  onCreateType: (category: TypeCategory, name: string) => number;
  onRenameType: (category: TypeCategory, id: number, name: string) => void;
  onDeleteType: (category: TypeCategory, id: number) => void;
  onRenameVariable: (id: number, name: string) => void;
  onRenameSwitch: (id: number, name: string) => void;
  onCreateSwitch: (name: string) => number;
  onCreateVariable: (name: string) => number;
} & Omit<ProjectTilesetManagerProps, 'game'>;

const sectionLabels: Record<DatabaseSection, string> = { tilesets: 'Tilesets', items: 'Items', skills: 'Skills', enemies: 'Enemies', troops: 'Troops', commonEvents: 'Common Events', system: 'System', types: 'Types', variables: 'Variables', switches: 'Switches' };
const typeCategoryLabels: Record<TypeCategory, string> = { elements: 'Elements', skills: 'Skill Types', weapons: 'Weapon Types', armors: 'Armor Types', equipment: 'Equipment Types' };
const typeCategories = Object.keys(typeCategoryLabels) as TypeCategory[];

function getSectionEntries(game: SourceGame, section: DatabaseSection): Record<string, DatabaseListEntry> {
  if (section === 'system') return {};
  if (section === 'tilesets') return game.tilesets;
  if (section === 'items') return game.items as unknown as Record<string, DatabaseListEntry>;
  if (section === 'skills') return game.skills as unknown as Record<string, DatabaseListEntry>;
  if (section === 'enemies') return game.enemies as unknown as Record<string, DatabaseListEntry>;
  if (section === 'troops') return game.troops as unknown as Record<string, DatabaseListEntry>;
  if (section === 'commonEvents') return game.events.commonEvents as unknown as Record<string, DatabaseListEntry>;
  if (section === 'variables') return game.initialState.variables as unknown as Record<string, DatabaseListEntry>;
  if (section === 'types') return {};
  return game.initialState.switches as unknown as Record<string, DatabaseListEntry>;
}

function sectionCount(game: SourceGame, section: DatabaseSection) {
  return section === 'types' ? typeCategories.reduce((count, category) => count + game.types[category].entries.length, 0) : Object.keys(getSectionEntries(game, section)).length;
}

function entryDetail(section: Exclude<DatabaseSection, 'tilesets' | 'types'>, entry: DatabaseListEntry) {
  if (section === 'items' || section === 'skills') return entry.type || 'Unknown';
  if (section === 'enemies') return `${(entry as unknown as EnemyTemplate).stats.maxHp} HP`;
  if (section === 'troops') return `${(entry as unknown as Troop).members.length} enemies`;
  if (section === 'commonEvents') return (entry as CommonEvent).trigger.type;
  if (section === 'switches') return entry.initialValue ? 'On' : 'Off';
  return String(entry.initialValue ?? 0);
}

function detailColumnLabel(section: Exclude<DatabaseSection, 'tilesets' | 'types'>) {
  if (section === 'items' || section === 'skills') return 'Type';
  if (section === 'enemies') return 'Health';
  if (section === 'troops') return 'Members';
  if (section === 'commonEvents') return 'Trigger';
  return 'Initial value';
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
  return <Select value={value} onValueChange={next => onChange(next as T)}><SelectTrigger className="w-full" aria-label={ariaLabel}><SelectValue>{labels[value]}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{values.map(option => <SelectItem key={option} value={option}>{labels[option]}</SelectItem>)}</SelectGroup></SelectContent></Select>;
}

function ItemForm({ id, item, game, onChange }: { id: number; item: Item; game: SourceGame; onChange: (item: Item) => void }) {
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

function SkillForm({ id, skill, onChange }: { id: number; skill: Skill; onChange: (skill: Skill) => void }) {
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

function battleAssetUrl(path: string | undefined, assets: LibraryBattleAsset[], assetUrls: Record<string, string>) {
  return path ? assetUrls[path] || assets.find(asset => asset.imagePath === path)?.url : undefined;
}

function battleBackgroundStyle(background: BattleBackground | undefined, assets: LibraryBattleAsset[], assetUrls: Record<string, string>): CSSProperties | undefined {
  if (!background) return undefined;
  const lowerUrl = battleAssetUrl(background.lowerImage, assets, assetUrls);
  const upperUrl = battleAssetUrl(background.upperImage, assets, assetUrls);
  return lowerUrl && upperUrl ? { backgroundImage: `url("${upperUrl}"), url("${lowerUrl}")` } : undefined;
}

export function troopCompositionName(troop: Troop, enemies: SourceGame['enemies']) {
  const counts = new Map<number, number>();
  for (const member of troop.members) counts.set(member.enemyId, (counts.get(member.enemyId) || 0) + 1);
  return [...counts].map(([enemyId, count]) => {
    const name = enemies[enemyId]?.name || `Enemy ${enemyId}`;
    return count > 1 ? `${name} ×${count}` : name;
  }).join(', ');
}

function BattleAssetPicker({ open, title, assets, onOpenChange, onSelect }: { open: boolean; title: string; assets: LibraryBattleAsset[]; onOpenChange: (open: boolean) => void; onSelect: (asset: LibraryBattleAsset) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const visible = assets.filter(asset => `${asset.name} ${asset.tags.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] max-w-3xl sm:max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Select an asset from the bundled battle library. It will be imported into this project.</DialogDescription></DialogHeader><Input type="search" value={query} aria-label={`Search ${title.toLocaleLowerCase()}`} placeholder="Search assets…" onChange={event => setQuery(event.target.value)} /><div className="grid min-h-0 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">{visible.map(asset => <Button key={asset.id} type="button" variant="outline" className="h-auto min-h-32 flex-col p-2" onClick={() => void onSelect(asset)}><img src={asset.url} alt="" className="h-24 w-full object-contain [image-rendering:pixelated]" /><span className="w-full truncate text-xs">{asset.name}</span></Button>)}</div></DialogContent></Dialog>;
}

function BattleBackgroundPicker({ open, title, assets, initial, onOpenChange, onSelect }: { open: boolean; title: string; assets: LibraryBattleAsset[]; initial?: BattleBackground; onOpenChange: (open: boolean) => void; onSelect: (background: BattleBackground, assets: LibraryBattleAsset[]) => Promise<void> }) {
  const lowerAssets = assets.filter(asset => asset.assetType === 'battle-background-lower');
  const upperAssets = assets.filter(asset => asset.assetType === 'battle-background-upper');
  const [lowerImage, setLowerImage] = useState('');
  const [upperImage, setUpperImage] = useState('');
  useEffect(() => { if (open) { setLowerImage(initial?.lowerImage || ''); setUpperImage(initial?.upperImage || ''); } }, [initial, open]);
  const layer = (label: string, choices: LibraryBattleAsset[], selected: string, select: (path: string) => void) => <section className="min-h-0"><h3 className="mb-2 text-xs font-medium">{label}</h3><div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">{choices.map(asset => <Button key={asset.id} type="button" variant={selected === asset.imagePath ? 'secondary' : 'outline'} aria-pressed={selected === asset.imagePath} className="h-auto min-h-28 flex-col p-2" onClick={() => select(asset.imagePath)}><img src={asset.url} alt="" className="h-20 w-full object-contain [image-rendering:pixelated]" /><span className="w-full truncate text-xs">{asset.name}</span></Button>)}</div></section>;
  const selectedAssets = assets.filter(asset => asset.imagePath === lowerImage || asset.imagePath === upperImage);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-5xl sm:max-w-5xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Compose the scene with a ground from battlebacks1 and a backdrop from battlebacks2.</DialogDescription></DialogHeader><div className="grid min-h-0 grid-cols-2 gap-4">{layer('Ground (battlebacks1)', lowerAssets, lowerImage, setLowerImage)}{layer('Backdrop (battlebacks2)', upperAssets, upperImage, setUpperImage)}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!lowerImage || !upperImage} onClick={() => void onSelect({ lowerImage, upperImage }, selectedAssets)}>Apply background</Button></DialogFooter></DialogContent></Dialog>;
}

function EnemyForm({ id, enemy, battleAssets, assetUrls, onImportBattleAsset, onChange }: { id: number; enemy: EnemyTemplate; battleAssets: LibraryBattleAsset[]; assetUrls: Record<string, string>; onImportBattleAsset: (asset: LibraryBattleAsset) => Promise<void>; onChange: (enemy: EnemyTemplate) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const assets = battleAssets.filter(asset => asset.assetType === 'side-view-enemy-battler');
  const imageUrl = battleAssetUrl(enemy.image, assets, assetUrls);
  return <>
    <EditorForm title={enemy.name} id={id} icon={<Shield />}>
      <Field label="Name"><BufferedTextInput value={enemy.name} ariaLabel="Enemy name" onCommit={name => onChange({ ...enemy, name })} /></Field>
      <Field label="Image" description="Choose a side-view enemy battler from the asset library."><div className="flex items-center gap-3">{imageUrl ? <img src={imageUrl} alt="" className="size-28 border bg-muted/20 object-contain [image-rendering:pixelated]" /> : <div className="grid size-28 place-items-center border border-dashed text-muted-foreground"><ImageIcon /></div>}<Toggle pressed={pickerOpen} onPressedChange={setPickerOpen} variant="outline" aria-label="Choose enemy image"><Images />Choose image</Toggle></div></Field>
      <div className="grid grid-cols-3 gap-4"><Field label="Max HP"><BufferedNumberInput min={1} value={enemy.stats.maxHp} ariaLabel="Enemy max HP" onCommit={maxHp => onChange({ ...enemy, stats: { ...enemy.stats, maxHp } })} /></Field><Field label="Attack"><BufferedNumberInput value={enemy.stats.attack} ariaLabel="Enemy attack" onCommit={attack => onChange({ ...enemy, stats: { ...enemy.stats, attack } })} /></Field><Field label="Defense"><BufferedNumberInput value={enemy.stats.defense} ariaLabel="Enemy defense" onCommit={defense => onChange({ ...enemy, stats: { ...enemy.stats, defense } })} /></Field></div>
      <Field label="Experience"><BufferedNumberInput value={enemy.rewards.xp} ariaLabel="Enemy experience" onCommit={xp => onChange({ ...enemy, rewards: { ...enemy.rewards, xp } })} /></Field>
    </EditorForm>
    <BattleAssetPicker open={pickerOpen} title="Enemy image" assets={assets} onOpenChange={setPickerOpen} onSelect={async asset => { await onImportBattleAsset(asset); onChange({ ...enemy, image: asset.imagePath }); setPickerOpen(false); }} />
  </>;
}

function TroopForm({ id, troop, game, battleAssets, assetUrls, onImportBattleAsset, onChange, onBattleTest }: { id: number; troop: Troop; game: SourceGame; battleAssets: LibraryBattleAsset[]; assetUrls: Record<string, string>; onImportBattleAsset: (asset: LibraryBattleAsset) => Promise<void>; onChange: (troop: Troop) => void; onBattleTest: () => void }) {
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enemyId, setEnemyId] = useState(String(Object.keys(game.enemies)[0] || ''));
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const backgrounds = battleAssets.filter(asset => asset.assetType.startsWith('battle-background'));
  const defaultBackground = game.ui.battle?.background;
  const background = troop.background || defaultBackground;
  const backgroundStyle = battleBackgroundStyle(background, backgrounds, assetUrls);
  useEffect(() => setSelectedMember(current => current === null ? null : Math.min(current, Math.max(0, troop.members.length - 1))), [troop.members.length]);
  const moveMember = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.index !== index || drag.pointerId !== event.pointerId || !(event.buttons & 1) || !previewRef.current) return;
    const bounds = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, drag.startX + (event.clientX - drag.startClientX) / bounds.width * 100));
    const y = Math.max(0, Math.min(100, drag.startY + (event.clientY - drag.startClientY) / bounds.height * 100));
    onChange({ ...troop, members: troop.members.map((member, memberIndex) => memberIndex === index ? { ...member, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : member) });
  };
  const removeMember = () => {
    if (selectedMember === null || !troop.members[selectedMember]) return;
    onChange({ ...troop, members: troop.members.filter((_, index) => index !== selectedMember) });
  };
  return <>
    <EditorForm title={troop.name} id={id} icon={<Swords />}>
      <Field label="Name" description="Auto name uses the troop composition and groups identical enemies."><div className="flex gap-2"><BufferedTextInput value={troop.name} ariaLabel="Troop name" onCommit={name => onChange({ ...troop, name })} /><Button type="button" variant="outline" disabled={!troop.members.length} onClick={() => onChange({ ...troop, name: troopCompositionName(troop, game.enemies) })}><WandSparkles />Auto name</Button></div></Field>
      <Field label="Battle test" description="Open this troop directly in the Player with the current unsaved project state."><Button type="button" variant="outline" className="justify-self-start" disabled={!troop.members.length} onClick={onBattleTest}><Play />Battle Test</Button></Field>
      <Field label="Troop background" description="Leave unset to use the default background configured in System."><div className="flex gap-2"><Toggle pressed={pickerOpen} onPressedChange={setPickerOpen} variant="outline"><Images />Choose</Toggle>{troop.background && <Button type="button" variant="ghost" onClick={() => onChange({ ...troop, background: undefined })}><X />Use default</Button>}</div></Field>
      <Field label="Battle scene" description="Select an enemy, then drag it to position it. Coordinates are stored as percentages of the 16:9 battle screen."><div ref={previewRef} aria-label="Troop battle preview" className="relative aspect-video w-full overflow-hidden border bg-muted/30 bg-cover bg-center" style={backgroundStyle}>{troop.members.map((member, index) => { const enemy = game.enemies[member.enemyId]; const imageUrl = battleAssetUrl(enemy?.image, battleAssets, assetUrls); return <button key={`${member.enemyId}:${index}`} type="button" aria-label={`Troop member ${index + 1}: ${enemy?.name || member.enemyId}`} aria-pressed={selectedMember === index} className={cn('absolute grid w-28 -translate-x-1/2 -translate-y-1/2 cursor-move justify-items-center rounded-sm p-1 outline-none', selectedMember === index && 'ring-2 ring-primary')} style={{ left: `${member.x}%`, top: `${member.y}%` }} onPointerDown={event => { if (selectedMember !== index) { setSelectedMember(index); return; } event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); dragRef.current = { index, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: member.x, startY: member.y }; }} onPointerMove={event => moveMember(index, event)} onPointerUp={event => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }} onPointerCancel={event => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; }}>{imageUrl ? <img src={imageUrl} alt="" draggable={false} className="size-20 object-contain [image-rendering:pixelated]" /> : <span className="grid size-16 place-items-center bg-primary/20">!</span>}<span className="max-w-24 truncate bg-background/80 px-1 text-[10px]">{enemy?.name || member.enemyId}</span></button>; })}<div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] border-t bg-background/70" /></div></Field>
      <Field label="Members" description={!troop.members.length ? 'Add at least one enemy before playing or exporting this project.' : `${troop.members.length} member${troop.members.length === 1 ? '' : 's'} in this troop.`}><div className="flex gap-2">{Object.keys(game.enemies).length ? <TypeSelect value={enemyId || String(Object.keys(game.enemies)[0])} values={Object.keys(game.enemies)} labels={Object.fromEntries(Object.entries(game.enemies).map(([enemyKey, enemy]) => [enemyKey, enemy.name]))} ariaLabel="Enemy to add" onChange={setEnemyId} /> : <p className="text-xs text-muted-foreground">Create an enemy first.</p>}<Button type="button" variant="outline" disabled={!enemyId} onClick={() => onChange({ ...troop, members: [...troop.members, { enemyId: Number(enemyId), x: 28, y: 48 }] })}><Plus />Add enemy</Button><Button type="button" variant="ghost" disabled={selectedMember === null || !troop.members[selectedMember]} onClick={removeMember}><Trash2 />Remove selected</Button></div></Field>
    </EditorForm>
    <BattleBackgroundPicker open={pickerOpen} title="Troop background" assets={backgrounds} initial={background} onOpenChange={setPickerOpen} onSelect={async (next, selectedAssets) => { await Promise.all(selectedAssets.map(asset => onImportBattleAsset(asset))); onChange({ ...troop, background: next }); setPickerOpen(false); }} />
  </>;
}

function SystemSection({ game, battleAssets, assetUrls, onImportBattleAsset, onUpdateDefaultBattleBackground }: Pick<DatabaseManagerProps, 'game' | 'battleAssets' | 'assetUrls' | 'onImportBattleAsset' | 'onUpdateDefaultBattleBackground'>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const backgrounds = battleAssets.filter(asset => asset.assetType.startsWith('battle-background'));
  const defaultBackground = game.ui.battle?.background;
  const backgroundStyle = battleBackgroundStyle(defaultBackground, backgrounds, assetUrls);
  return <>
    <section className="flex min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center border-b px-4"><h2 className="text-sm font-semibold">System</h2></div>
      <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto grid max-w-2xl gap-6 p-8">
        <div className="flex items-center gap-3 border-b pb-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Settings className="size-5" /></div><div><h3 className="text-base font-semibold">Battle</h3><p className="text-[10px] text-muted-foreground">Shared settings used by every troop.</p></div></div>
        <Field label="Default background" description="Troops without a custom background use this composed scene."><div className="grid gap-3">{backgroundStyle && <div role="img" aria-label="Default battle background" className="aspect-video w-full max-w-sm border bg-muted/20 bg-cover bg-center [image-rendering:pixelated]" style={backgroundStyle} />}<div className="flex gap-2"><Toggle pressed={pickerOpen} onPressedChange={setPickerOpen} variant="outline"><Images />Choose default</Toggle>{defaultBackground && <Button type="button" variant="ghost" onClick={() => onUpdateDefaultBattleBackground(undefined)}><X />Clear</Button>}</div></div></Field>
      </div></div>
    </section>
    <BattleBackgroundPicker open={pickerOpen} title="Default battle background" assets={backgrounds} initial={defaultBackground} onOpenChange={setPickerOpen} onSelect={async (next, selectedAssets) => { await Promise.all(selectedAssets.map(asset => onImportBattleAsset(asset))); onUpdateDefaultBattleBackground(next); setPickerOpen(false); }} />
  </>;
}

function CommonEventForm({ id, commonEvent, game, onChange, onCreateSwitch, onCreateVariable }: { id: number; commonEvent: CommonEvent; game: SourceGame; onChange: (commonEvent: CommonEvent) => void; onCreateSwitch: (name: string) => number; onCreateVariable: (name: string) => number }) {
  const [pendingTriggerType, setPendingTriggerType] = useState<'autorun' | 'parallel' | null>(null);
  const [autoOpenTriggerSwitch, setAutoOpenTriggerSwitch] = useState(false);
  useEffect(() => { setPendingTriggerType(null); setAutoOpenTriggerSwitch(false); }, [id]);
  const triggerType = pendingTriggerType || commonEvent.trigger.type;
  const switchId = commonEvent.trigger.type === 'none' ? 0 : commonEvent.trigger.switchId;
  const changeTrigger = (type: CommonEvent['trigger']['type']) => {
    if (type === 'none') {
      setPendingTriggerType(null);
      onChange({ ...commonEvent, trigger: { type } });
      return;
    }
    const nextSwitchId = switchId || Number(Object.keys(game.initialState.switches)[0]) || 0;
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

function EditorForm({ title, id, icon, children }: { title: string; id: string | number; icon: ReactNode; children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto grid max-w-2xl gap-6 p-8"><div className="flex items-center gap-3 border-b pb-5"><div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-5">{icon}</div><div className="min-w-0"><h2 className="truncate text-base font-semibold">{title}</h2><p className="font-mono text-[10px] text-muted-foreground">{id}</p></div></div><div className="grid gap-5">{children}</div></div></div>;
}

function ReferenceList({ references }: { references: DatabaseReference[] }) {
  return <Field label="Usages" description={references.length ? `${references.length} reference${references.length === 1 ? '' : 's'} found in the project.` : 'This entry is not currently used.'}>
    {references.length ? <div className="rounded-md border">{references.map((reference, index) => <div key={`${reference.path}:${index}`} className="border-b px-3 py-2.5 last:border-b-0"><div className="text-xs font-medium">{reference.label}</div><div className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{reference.path}</div></div>)}</div> : <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">No usages found.</div>}
  </Field>;
}

function SystemEntryForm({ id, kind, game, onRename }: { id: number; kind: 'variable' | 'switch'; game: SourceGame; onRename: (name: string) => void }) {
  const definition = kind === 'variable' ? game.initialState.variables[id] : game.initialState.switches[id];
  const references = useMemo(() => findDatabaseReferences(game, kind, id), [game, id, kind]);
  const initialValue = definition.initialValue;
  return <EditorForm title={definition.name} id={id} icon={kind === 'variable' ? <Variable /> : <ToggleLeft />}>
    <Field label="Name"><BufferedTextInput value={definition.name} ariaLabel={`${kind === 'variable' ? 'Variable' : 'Switch'} name`} onCommit={onRename} /></Field>
    <Field label="Initial value" description="The initial value is shown for reference and cannot be changed here yet."><Input aria-label={`${kind === 'variable' ? 'Variable' : 'Switch'} initial value`} value={String(initialValue)} readOnly /></Field>
    <ReferenceList references={references} />
  </EditorForm>;
}

function TypesSection({ game, category, onCreateType, onRenameType, onDeleteType }: Pick<DatabaseManagerProps, 'game' | 'onCreateType' | 'onRenameType' | 'onDeleteType'> & { category: TypeCategory }) {
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
    const references = category === 'equipment' ? findDatabaseReferences(game, 'equipmentType', entry.id) : [];
    setPendingDelete({ entry, references });
  };
  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.references.length) return;
    onDeleteType(category, pendingDelete.entry.id);
    setPendingDelete(null);
  };
  return <>
    <section className="flex min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4"><div><h2 className="text-sm font-semibold">{typeCategoryLabels[category]}</h2><p className="text-[10px] text-muted-foreground">IDs are assigned automatically and remain stable.</p></div><Button type="button" size="sm" aria-label={`Create ${typeCategoryLabels[category]}`} onClick={() => setCreateOpen(true)}><Plus />Add type</Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {catalog.entries.length ? <div className="mx-auto max-w-2xl"><Table aria-label={typeCategoryLabels[category]}>
          <TableHeader><TableRow><TableHead className="w-24 pl-4">ID</TableHead><TableHead>Name</TableHead><TableHead className="w-12"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>{catalog.entries.map(entry => {
            const selected = selectedIds[category] === entry.id;
            return <TableRow key={entry.id} data-state={selected ? 'selected' : undefined} onClick={() => setSelectedIds(current => ({ ...current, [category]: entry.id }))}>
              <TableCell className="pl-4 font-mono tabular-nums">{entry.id}</TableCell>
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
  const [typeCategory, setTypeCategory] = useState<TypeCategory>('elements');
  const [typesOpen, setTypesOpen] = useState(false);
  const [queries, setQueries] = useState<Record<DatabaseSection, string>>({ tilesets: '', items: '', skills: '', enemies: '', troops: '', commonEvents: '', system: '', types: '', variables: '', switches: '' });
  const [selectedIds, setSelectedIds] = useState<Record<DatabaseSection, string>>({ tilesets: Object.keys(game.tilesets)[0] || '', items: Object.keys(game.items)[0] || '', skills: Object.keys(game.skills)[0] || '', enemies: Object.keys(game.enemies)[0] || '', troops: Object.keys(game.troops)[0] || '', commonEvents: Object.keys(game.events.commonEvents)[0] || '', system: '', types: '', variables: Object.keys(game.initialState.variables)[0] || '', switches: Object.keys(game.initialState.switches)[0] || '' });
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
  const navigationGroups: Array<{ label: string; sections: DatabaseSection[] }> = [
    { label: 'Game', sections: game.manifest.combatMode === 'turnBased' ? ['items', 'skills', 'enemies', 'troops', 'commonEvents'] : ['items', 'skills', 'enemies', 'commonEvents'] },
    { label: 'System', sections: ['system', 'tilesets', 'types', 'variables', 'switches'] },
  ];

  useEffect(() => {
    setSelectedIds(current => {
      const next = { ...current };
      if (!game.tilesets[next.tilesets]) next.tilesets = Object.keys(game.tilesets)[0] || '';
      if (!game.items[Number(next.items)]) next.items = Object.keys(game.items)[0] || '';
      if (!game.skills[Number(next.skills)]) next.skills = Object.keys(game.skills)[0] || '';
      if (!game.enemies[Number(next.enemies)]) next.enemies = Object.keys(game.enemies)[0] || '';
      if (!game.troops[Number(next.troops)]) next.troops = Object.keys(game.troops)[0] || '';
      if (!game.events.commonEvents[Number(next.commonEvents)]) next.commonEvents = Object.keys(game.events.commonEvents)[0] || '';
      if (!game.initialState.variables[Number(next.variables)]) next.variables = Object.keys(game.initialState.variables)[0] || '';
      if (!game.initialState.switches[Number(next.switches)]) next.switches = Object.keys(game.initialState.switches)[0] || '';
      return next.tilesets === current.tilesets && next.items === current.items && next.skills === current.skills && next.enemies === current.enemies && next.troops === current.troops && next.commonEvents === current.commonEvents && next.variables === current.variables && next.switches === current.switches ? current : next;
    });
  }, [game.enemies, game.events.commonEvents, game.initialState.switches, game.initialState.variables, game.items, game.skills, game.tilesets, game.troops]);

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    if (section !== 'items' && section !== 'skills' && section !== 'enemies' && section !== 'troops' && section !== 'commonEvents') return;
    const id = section === 'items' ? props.onCreateItem(name, newItemType) : section === 'skills' ? props.onCreateSkill(name, newSkillType) : section === 'enemies' ? props.onCreateEnemy(name) : section === 'troops' ? props.onCreateTroop(name) : props.onCreateCommonEvent(name);
    setSelectedIds(current => ({ ...current, [section]: String(id) }));
    setCreateOpen(false);
    setNewName('');
  };
  const duplicate = () => {
    if (!selectedId || section !== 'items' && section !== 'skills' && section !== 'enemies' && section !== 'troops' && section !== 'commonEvents') return;
    const numericId = Number(selectedId);
    const id = section === 'items' ? props.onDuplicateItem(numericId) : section === 'skills' ? props.onDuplicateSkill(numericId) : section === 'enemies' ? props.onDuplicateEnemy(numericId) : section === 'troops' ? props.onDuplicateTroop(numericId) : props.onDuplicateCommonEvent(numericId);
    setSelectedIds(current => ({ ...current, [section]: String(id) }));
  };
  const requestDelete = () => {
    if (!selected || section !== 'items' && section !== 'skills' && section !== 'enemies' && section !== 'troops' && section !== 'commonEvents') return;
    const kind = section === 'items' ? 'item' : section === 'skills' ? 'skill' : section === 'enemies' ? 'enemy' : section === 'troops' ? 'troop' : 'commonEvent';
    setPendingDelete({ kind, id: Number(selectedId), name: selected.name, references: findDatabaseReferences(game, kind, Number(selectedId)) });
  };
  const confirmDelete = () => {
    if (!pendingDelete || pendingDelete.references.length) return;
    if (pendingDelete.kind === 'item') props.onDeleteItem(pendingDelete.id); else if (pendingDelete.kind === 'skill') props.onDeleteSkill(pendingDelete.id); else if (pendingDelete.kind === 'enemy') props.onDeleteEnemy(pendingDelete.id); else if (pendingDelete.kind === 'troop') props.onDeleteTroop(pendingDelete.id); else props.onDeleteCommonEvent(pendingDelete.id);
    setPendingDelete(null);
  };

  return <div className="flex size-full min-h-0 flex-col" data-slot="database-manager">
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
      <SidebarProvider className="min-h-0 w-auto" style={{ '--sidebar-width': '240px' } as CSSProperties}>
        <Sidebar collapsible="none" className="border-r" data-database-sidebar="sections">
          <SidebarContent><nav aria-label="Database sections">
            {navigationGroups.map(group => <SidebarGroup key={group.label}><SidebarGroupLabel>{group.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
              {group.sections.map(menuSection => {
                const active = section === menuSection;
                const count = sectionCount(game, menuSection);
                const Icon = menuSection === 'system' ? Settings : menuSection === 'tilesets' ? Images : menuSection === 'items' ? Package : menuSection === 'skills' ? WandSparkles : menuSection === 'enemies' ? Shield : menuSection === 'troops' ? Swords : menuSection === 'commonEvents' ? Workflow : menuSection === 'types' ? Tags : menuSection === 'variables' ? Variable : ToggleLeft;
                if (menuSection === 'types') return <SidebarMenuItem key={menuSection}><Collapsible open={typesOpen} onOpenChange={setTypesOpen}>
                  <CollapsibleTrigger render={<SidebarMenuButton isActive={active} aria-current={active ? 'page' : undefined} onClick={() => setSection('types')} />}><Icon /><span>{sectionLabels[menuSection]}</span><ChevronRight className={cn('ml-auto mr-5 transition-transform', typesOpen && 'rotate-90')} /></CollapsibleTrigger>
                  <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  <CollapsibleContent><SidebarMenuSub aria-label="Type categories">
                    {typeCategories.map(category => <SidebarMenuSubItem key={category}><SidebarMenuSubButton render={<button type="button" />} isActive={active && typeCategory === category} aria-label={typeCategoryLabels[category]} aria-current={active && typeCategory === category ? 'page' : undefined} onClick={() => { setTypeCategory(category); setSection('types'); }}><span>{typeCategoryLabels[category]}</span><span aria-hidden="true" className="ml-auto tabular-nums text-muted-foreground">{game.types[category].entries.length}</span></SidebarMenuSubButton></SidebarMenuSubItem>)}
                  </SidebarMenuSub></CollapsibleContent>
                </Collapsible></SidebarMenuItem>;
                return <SidebarMenuItem key={menuSection}><SidebarMenuButton isActive={active} aria-current={active ? 'page' : undefined} onClick={() => setSection(menuSection)}><Icon /><span>{sectionLabels[menuSection]}</span></SidebarMenuButton>{menuSection !== 'system' && <SidebarMenuBadge>{count}</SidebarMenuBadge>}</SidebarMenuItem>;
              })}
            </SidebarMenu></SidebarGroupContent></SidebarGroup>)}
          </nav></SidebarContent>
        </Sidebar>
      </SidebarProvider>
      {section === 'system' ? <div className="min-h-0"><SystemSection game={game} battleAssets={props.battleAssets} assetUrls={props.assetUrls} onImportBattleAsset={props.onImportBattleAsset} onUpdateDefaultBattleBackground={props.onUpdateDefaultBattleBackground} /></div> : section === 'tilesets' ? <div className="min-h-0"><ProjectTilesetManager game={game} assetUrls={props.assetUrls} onImportLocal={props.onImportLocal} onUpdate={props.onUpdate} onChangeTerrainCollision={props.onChangeTerrainCollision} /></div> : section === 'types' ? <div className="min-h-0"><TypesSection game={game} category={typeCategory} onCreateType={props.onCreateType} onRenameType={props.onRenameType} onDeleteType={props.onDeleteType} /></div> : <div className="grid min-h-0 grid-cols-2"><aside className="flex min-h-0 flex-col border-r bg-background" data-slot="database-entry-table">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{sectionLabels[section]}</h2>{(section === 'items' || section === 'skills' || section === 'enemies' || section === 'troops' || section === 'commonEvents') && <Button type="button" size="icon-sm" aria-label={`Create ${section === 'items' ? 'item' : section === 'skills' ? 'skill' : section === 'enemies' ? 'enemy' : section === 'troops' ? 'troop' : 'common event'}`} onClick={() => setCreateOpen(true)}><Plus /></Button>}</div>
          <div className="shrink-0 border-b p-3"><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input type="search" className="pl-7" aria-label={`Search ${section}`} placeholder={`Search ${section}…`} value={query} onChange={event => setQueries(current => ({ ...current, [section]: event.target.value }))} /></div></div>
          {visibleEntries.length ? <div className="min-h-0 flex-1 overflow-auto"><Table aria-label={sectionLabels[section]}><TableHeader><TableRow><TableHead className="pl-4">ID</TableHead><TableHead>Name</TableHead><TableHead>{detailColumnLabel(section as Exclude<DatabaseSection, 'tilesets' | 'types'>)}</TableHead></TableRow></TableHeader><TableBody>{visibleEntries.map(([id, entry]) => <TableRow key={id} data-state={id === selectedId ? 'selected' : undefined} aria-selected={id === selectedId} className="cursor-pointer" onClick={() => setSelectedIds(current => ({ ...current, [section]: id }))}><TableCell className="pl-4 font-mono text-muted-foreground">{id}</TableCell><TableCell className="font-medium">{entry.name}</TableCell><TableCell className="capitalize text-muted-foreground">{entryDetail(section as Exclude<DatabaseSection, 'tilesets' | 'types'>, entry)}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-xs text-muted-foreground">{query ? `No ${section} match your search.` : `No ${section} yet.`}</div>}
        </aside>
      <section className="flex min-h-0 flex-col bg-background">
        {selected ? <>
          {(section === 'items' || section === 'skills' || section === 'enemies' || section === 'troops' || section === 'commonEvents') && <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b px-4"><Button type="button" variant="outline" size="sm" onClick={duplicate}><Copy />Duplicate</Button><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={requestDelete}><Trash2 />Delete</Button></div>}
          {section === 'items' ? <ItemForm id={Number(selectedId)} item={selected as Item} game={game} onChange={item => props.onUpdateItem(Number(selectedId), item)} /> : section === 'skills' ? <SkillForm id={Number(selectedId)} skill={selected as Skill} onChange={skill => props.onUpdateSkill(Number(selectedId), skill)} /> : section === 'enemies' ? <EnemyForm id={Number(selectedId)} enemy={selected as unknown as EnemyTemplate} battleAssets={props.battleAssets} assetUrls={props.assetUrls} onImportBattleAsset={props.onImportBattleAsset} onChange={enemy => props.onUpdateEnemy(Number(selectedId), enemy)} /> : section === 'troops' ? <TroopForm id={Number(selectedId)} troop={selected as unknown as Troop} game={game} battleAssets={props.battleAssets} assetUrls={props.assetUrls} onImportBattleAsset={props.onImportBattleAsset} onChange={troop => props.onUpdateTroop(Number(selectedId), troop)} onBattleTest={() => props.onBattleTest(Number(selectedId))} /> : section === 'commonEvents' ? <CommonEventForm id={Number(selectedId)} commonEvent={selected as CommonEvent} game={game} onChange={commonEvent => props.onUpdateCommonEvent(Number(selectedId), commonEvent)} onCreateSwitch={props.onCreateSwitch} onCreateVariable={props.onCreateVariable} /> : <SystemEntryForm id={Number(selectedId)} kind={section === 'variables' ? 'variable' : 'switch'} game={game} onRename={name => section === 'variables' ? props.onRenameVariable(Number(selectedId), name) : props.onRenameSwitch(Number(selectedId), name)} />}
        </> : <div className="grid size-full place-items-center p-8 text-center"><div><Database className="mx-auto mb-3 size-8 text-muted-foreground" /><h2 className="text-sm font-semibold">No {section} to edit</h2><p className="mt-1 text-xs text-muted-foreground">{section === 'items' || section === 'skills' || section === 'enemies' || section === 'troops' || section === 'commonEvents' ? 'Create one to start building your game database.' : `No ${section} are configured for this project.`}</p>{(section === 'items' || section === 'skills' || section === 'enemies' || section === 'troops' || section === 'commonEvents') && <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus />Create {section === 'items' ? 'item' : section === 'skills' ? 'skill' : section === 'enemies' ? 'enemy' : section === 'troops' ? 'troop' : 'common event'}</Button>}</div></div>}
      </section>
      </div>}
    </div>

    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setNewName(''); }}><DialogContent><DialogHeader><DialogTitle>Create {section === 'items' ? 'item' : section === 'skills' ? 'skill' : section === 'enemies' ? 'enemy' : section === 'troops' ? 'troop' : 'common event'}</DialogTitle><DialogDescription>The numeric ID is assigned automatically and remains stable.</DialogDescription></DialogHeader><div className="grid gap-4"><Field label="Name"><Input autoFocus aria-label="New entry name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); }} /></Field>{(section === 'items' || section === 'skills') && <Field label="Type">{section === 'items' ? <TypeSelect value={newItemType} values={['quest', 'consumable', 'equipment']} labels={{ quest: 'Quest', consumable: 'Consumable', equipment: 'Equipment' }} ariaLabel="New item type" onChange={setNewItemType} /> : <TypeSelect value={newSkillType} values={['melee', 'projectile', 'area']} labels={{ melee: 'Melee', projectile: 'Projectile', area: 'Area' }} ariaLabel="New skill type" onChange={setNewSkillType} />}</Field>}</div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!newName.trim()} onClick={create}>Create</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open) setPendingDelete(null); }}><AlertDialogContent className={pendingDelete?.references.length ? 'max-w-lg sm:max-w-lg' : undefined}><AlertDialogHeader><AlertDialogTitle>{pendingDelete?.references.length ? `Cannot delete ${pendingDelete.name}` : `Delete ${pendingDelete?.name}?`}</AlertDialogTitle><AlertDialogDescription>{pendingDelete?.references.length ? 'This entry is still used by the game. Remove these references before deleting it.' : 'This removes the entry from the project database. This action cannot be undone.'}</AlertDialogDescription></AlertDialogHeader>{Boolean(pendingDelete?.references.length) && <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-2">{pendingDelete!.references.map((reference, index) => <div key={`${reference.path}:${index}`} className="border-b px-2 py-2 last:border-b-0"><div className="text-xs font-medium">{reference.label}</div><div className="mt-0.5 break-all font-mono text-[9px] text-muted-foreground">{reference.path}</div></div>)}</div>}<AlertDialogFooter>{pendingDelete?.references.length ? <AlertDialogCancel>Close</AlertDialogCancel> : <><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction></>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
