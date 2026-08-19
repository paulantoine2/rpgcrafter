import { FilePlus2, FolderOpen, Swords, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RecentProject } from '@/lib/source-game';

type ProjectHomeProps = {
  recentProjects: RecentProject[];
  loading: boolean;
  error: string;
  onNewProject: () => void;
  onOpenArchive: (file: File) => void;
  onOpenRecent: (id: string) => void;
  onOpenReference: () => void;
  onOpenTurnBasedReference: () => void;
};

function ProjectIcon({ children }: { children: ReactNode }) {
  return <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{children}</span>;
}

export function ProjectHome({
  recentProjects,
  loading,
  error,
  onNewProject,
  onOpenArchive,
  onOpenRecent,
  onOpenReference,
  onOpenTurnBasedReference,
}: ProjectHomeProps) {
  return <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <header className="flex flex-col gap-6 border-b pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">RPG Crafter Studio</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your projects</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Pick up where you left off, explore a reference game, or start building a new world.</p>
        </div>
        <Button size="lg" className="h-10 self-start px-4 text-sm sm:self-auto" onClick={onNewProject}>
          <FilePlus2 className="size-4" /> New project
        </Button>
      </header>

      <section className="py-9" aria-labelledby="recent-projects-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 id="recent-projects-heading" className="text-base font-semibold">Recent projects</h2>
            <p className="mt-1 text-xs text-muted-foreground">Projects saved in this browser.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:ring-2 focus-within:ring-ring/30">
            <Upload className="size-3.5" /> Open project ZIP
            <Input className="sr-only" type="file" accept=".zip,application/zip" onChange={event => {
              const file = event.target.files?.[0];
              if (file) onOpenArchive(file);
              event.target.value = '';
            }} />
          </label>
        </div>

        {recentProjects.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recentProjects.map(project => <button
            key={project.id}
            type="button"
            className="group flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => onOpenRecent(project.id)}
            disabled={loading}
          >
            <ProjectIcon><FolderOpen className="size-5" /></ProjectIcon>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{project.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">Version {project.gameVersion} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(project.updatedAt)}</span>
            </span>
          </button>)}
        </div> : <div className="grid min-h-32 place-items-center rounded-xl border border-dashed bg-background/50 px-6 text-center">
          <div>
            <FolderOpen className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">No recent projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create a project or open a package to see it here.</p>
          </div>
        </div>}
      </section>

      <section className="border-t py-9" aria-labelledby="reference-projects-heading">
        <div className="mb-4">
          <h2 id="reference-projects-heading" className="text-base font-semibold">Reference projects</h2>
          <p className="mt-1 text-xs text-muted-foreground">Explore complete examples and learn from working game systems.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" className="group flex items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-sm outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50" onClick={onOpenReference} disabled={loading}>
            <ProjectIcon><FolderOpen className="size-5" /></ProjectIcon>
            <span><span className="block text-sm font-semibold">La Cloche des Brumes</span><span className="mt-1 block text-xs text-muted-foreground">Action RPG reference game</span></span>
          </button>
          <button type="button" className="group flex items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-sm outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50" onClick={onOpenTurnBasedReference} disabled={loading}>
            <ProjectIcon><Swords className="size-5" /></ProjectIcon>
            <span><span className="block text-sm font-semibold">La Cloche des Brumes — Turn-Based</span><span className="mt-1 block text-xs text-muted-foreground">Turn-based reference game</span></span>
          </button>
        </div>
      </section>

      {error && <pre className="mt-auto max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</pre>}
    </div>
  </main>;
}
