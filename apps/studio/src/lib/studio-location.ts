export type StudioMode = 'events' | 'drawing';
export type StudioTab = 'maps' | 'assets' | 'database';

export type StudioLocation = {
  projectId: string | null;
  mapId: string | null;
  mode: StudioMode;
  tab: StudioTab;
};

const isStudioMode = (value: string | null): value is StudioMode => value === 'events' || value === 'drawing';
const isStudioTab = (value: string | null): value is StudioTab => value === 'maps' || value === 'assets' || value === 'database';

export function readStudioLocation(search: string): StudioLocation {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const tab = params.get('tab');
  return {
    projectId: params.get('project'),
    mapId: params.get('map'),
    mode: isStudioMode(mode) ? mode : 'events',
    tab: isStudioTab(tab) ? tab : 'maps',
  };
}

export function studioLocationUrl(href: string, location: { projectId: string | null; mapId: string | null; mode: StudioMode; tab: StudioTab }) {
  const url = new URL(href);
  if (location.projectId) url.searchParams.set('project', location.projectId); else url.searchParams.delete('project');
  if (location.projectId && location.mapId) url.searchParams.set('map', location.mapId); else url.searchParams.delete('map');
  if (location.projectId) url.searchParams.set('mode', location.mode); else url.searchParams.delete('mode');
  if (location.projectId) url.searchParams.set('tab', location.tab); else url.searchParams.delete('tab');
  return `${url.pathname}${url.search}${url.hash}`;
}
