import { Boxes, File, FilePlus2, FolderOpen, Play, RotateCcw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButtonTooltip } from '@/components/ui/tooltip';

export function StudioAppSidebar({
  hasProject,
  canExport,
  assetManagerOpen,
  onNewProject,
  onOpenProject,
  onSaveDraft,
  onExportProject,
  onRevertProject,
  onCloseProject,
  onOpenAssetManager,
  onPlay,
}: {
  hasProject: boolean;
  canExport: boolean;
  assetManagerOpen: boolean;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveDraft: () => void;
  onExportProject: () => void;
  onRevertProject: () => void;
  onCloseProject: () => void;
  onOpenAssetManager: () => void;
  onPlay: () => void;
}) {
  return <aside className="flex w-12 shrink-0 flex-col items-center border-r bg-sidebar py-1" aria-label="Studio navigation">
    <nav className="flex w-full flex-col items-center gap-1" aria-label="Project tools">
      <DropdownMenu>
        <IconButtonTooltip label="File">
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-lg" aria-label="File"><File /></Button>} />
        </IconButtonTooltip>
        <DropdownMenuContent side="right" align="start" sideOffset={6} className="w-56">
          <DropdownMenuItem onClick={onNewProject}><FilePlus2 /> New Project…</DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenProject}><FolderOpen /> Open… <DropdownMenuShortcut>⌘O</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem disabled={!hasProject} onClick={onSaveDraft}><Save /> Save Draft <DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem disabled={!canExport} onClick={onExportProject}><Upload /> Export… <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasProject} onClick={onRevertProject}><RotateCcw /> Revert to Source</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasProject} onClick={onCloseProject}>Close Project</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButtonTooltip label="Asset Manager">
        <Button type="button" variant={assetManagerOpen ? 'secondary' : 'ghost'} size="icon-lg" disabled={!hasProject} aria-label="Asset Manager" aria-pressed={assetManagerOpen} onClick={onOpenAssetManager}><Boxes /></Button>
      </IconButtonTooltip>
    </nav>
    <div className="mt-auto border-t pt-1">
      <IconButtonTooltip label="Play">
        <Button type="button" variant="ghost" size="icon-lg" disabled={!canExport} aria-label="Play" onClick={onPlay}><Play className="fill-current" /></Button>
      </IconButtonTooltip>
    </div>
  </aside>;
}
