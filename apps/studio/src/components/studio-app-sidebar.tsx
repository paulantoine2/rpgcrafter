import { CirclePlus, Database, FilePlus2, FolderOpen, MapPinned, RotateCcw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import type { StudioInterface } from '@/lib/studio-interface';

function RpgCrafterLogo() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 17V7h4.25a3 3 0 0 1 0 6H8m4-0.25L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
  </svg>;
}

export function StudioAppSidebar({
  hasProject,
  canExport,
  activeTab,
  onNewProject,
  onOpenProject,
  onSaveDraft,
  onExportProject,
  onRevertProject,
  onCloseProject,
  studioInterface,
  onChangeStudioInterface,
  onSelectMaps,
  onSelectAssets,
  onSelectDatabase,
}: {
  hasProject: boolean;
  canExport: boolean;
  activeTab: 'maps' | 'assets' | 'database';
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveDraft: () => void;
  onExportProject: () => void;
  onRevertProject: () => void;
  onCloseProject: () => void;
  studioInterface: StudioInterface;
  onChangeStudioInterface: (value: StudioInterface) => void;
  onSelectMaps: () => void;
  onSelectAssets: () => void;
  onSelectDatabase: () => void;
}) {
  return <aside className="flex w-12 shrink-0 flex-col items-center border-r bg-sidebar py-1 text-sidebar-foreground" aria-label="Studio navigation">
    <div className="mb-1 border-b pb-1">
      <DropdownMenu>
        <IconButtonTooltip label="RPG Crafter menu">
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-lg" aria-label="RPG Crafter menu"><RpgCrafterLogo /></Button>} />
        </IconButtonTooltip>
        <DropdownMenuContent side="right" align="start" sideOffset={6} className="w-56">
          <DropdownMenuItem onClick={onNewProject}><FilePlus2 /> New Project…</DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenProject}><FolderOpen /> Open… <DropdownMenuShortcut>⌘O</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem disabled={!hasProject} onClick={onSaveDraft}><Save /> Save Draft <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem disabled={!canExport} onClick={onExportProject}><Upload /> Export… <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasProject} onClick={onRevertProject}><RotateCcw /> Revert to Source</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasProject} onClick={onCloseProject}>Close Project</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Interface</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={studioInterface} onValueChange={value => onChangeStudioInterface(value as StudioInterface)}>
                <DropdownMenuRadioItem value="modern">Modern</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="rpgMakerMz">RPG Maker MZ</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <nav className="flex w-full flex-col items-center gap-1" aria-label="Studio tabs">
      <IconButtonTooltip label="Maps">
        <Button type="button" variant={activeTab === 'maps' ? 'default' : 'ghost'} size="icon-lg" className="rounded-md" aria-label="Maps" aria-pressed={activeTab === 'maps'} onClick={onSelectMaps}><MapPinned /></Button>
      </IconButtonTooltip>
      <IconButtonTooltip label="Assets">
        <Button type="button" variant={activeTab === 'assets' ? 'default' : 'ghost'} size="icon-lg" className="rounded-md" disabled={!hasProject} aria-label="Assets" aria-pressed={activeTab === 'assets'} onClick={onSelectAssets}><CirclePlus /></Button>
      </IconButtonTooltip>
      <IconButtonTooltip label="Database">
        <Button type="button" variant={activeTab === 'database' ? 'default' : 'ghost'} size="icon-lg" className="rounded-md" disabled={!hasProject} aria-label="Database" aria-pressed={activeTab === 'database'} onClick={onSelectDatabase}><Database /></Button>
      </IconButtonTooltip>
    </nav>
  </aside>;
}
