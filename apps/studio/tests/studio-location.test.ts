import { describe, expect, it } from 'vitest';
import { readStudioLocation, studioLocationUrl } from '../src/lib/studio-location';

describe('studio URL location', () => {
  it('reads the open project, map and mode from search params', () => {
    expect(readStudioLocation('?project=game.demo%3A0.1.0&map=forest&mode=drawing&tab=database')).toEqual({
      projectId: 'game.demo:0.1.0', mapId: 'forest', mode: 'drawing', tab: 'database',
    });
  });

  it('falls back to events for an unknown mode', () => {
    expect(readStudioLocation('?project=reference&mode=unknown').mode).toBe('events');
    expect(readStudioLocation('?project=reference&mode=navigation').mode).toBe('events');
  });

  it('falls back to Maps for an unknown tab', () => {
    expect(readStudioLocation('?project=reference&tab=unknown').tab).toBe('maps');
    expect(readStudioLocation('?project=reference').tab).toBe('maps');
  });

  it('updates Studio params while preserving unrelated params and hashes', () => {
    expect(studioLocationUrl('http://localhost/?debug=1#studio', { projectId: 'reference', mapId: 'village', mode: 'drawing', tab: 'assets' }))
      .toBe('/?debug=1&project=reference&map=village&mode=drawing&tab=assets#studio');
  });

  it('removes map and mode when no project is open', () => {
    expect(studioLocationUrl('http://localhost/?project=reference&map=village&mode=drawing&tab=database', { projectId: null, mapId: null, mode: 'events', tab: 'maps' }))
      .toBe('/');
  });
});
