export type StudioMode = 'events' | 'drawing';

export type StudioLocation = {
  projectId: string | null;
  mapId: string | null;
  mode: StudioMode;
};

const isStudioMode = (value: string | null): value is StudioMode => value === 'events' || value === 'drawing';

export function readStudioLocation(search: string): StudioLocation {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return {
    projectId: params.get('project'),
    mapId: params.get('map'),
    mode: isStudioMode(mode) ? mode : 'events',
  };
}

export function studioLocationUrl(href: string, location: { projectId: string | null; mapId: string | null; mode: StudioMode }) {
  const url = new URL(href);
  if (location.projectId) url.searchParams.set('project', location.projectId); else url.searchParams.delete('project');
  if (location.projectId && location.mapId) url.searchParams.set('map', location.mapId); else url.searchParams.delete('map');
  if (location.projectId) url.searchParams.set('mode', location.mode); else url.searchParams.delete('mode');
  return `${url.pathname}${url.search}${url.hash}`;
}
