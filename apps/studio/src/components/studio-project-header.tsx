import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButtonTooltip } from '@/components/ui/tooltip';

export function StudioProjectHeader({ title, combatMode, canPlay, onPlay }: {
  title: string;
  combatMode: 'turnBased' | 'actionRpg';
  canPlay: boolean;
  onPlay: () => void;
}) {
  return <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4" data-slot="studio-project-header">
    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}<small className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{combatMode === 'turnBased' ? 'Turn-based' : 'Action RPG'}</small></span>
    <div className="flex shrink-0 items-center">
      <IconButtonTooltip label="Play">
        <Button type="button" variant="ghost" size="icon-lg" disabled={!canPlay} aria-label="Play" onClick={onPlay}><Play className="fill-current" /></Button>
      </IconButtonTooltip>
    </div>
  </div>;
}
