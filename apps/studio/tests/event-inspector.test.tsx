import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { MapEvent } from '@rpgcrafter/game-schema';
import { EventInspector } from '../src/components/event-inspector';
import { createMapEventAt } from '../src/lib/editor-events';
import { createEmptyProject } from '../src/lib/source-game';

function Harness() {
  const project = createEmptyProject('Inspector');
  const [event, setEvent] = useState<MapEvent>(() => createMapEventAt(project.game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' }));
  project.game.maps['map-1'].events = [event];
  return <EventInspector game={project.game} mapId="map-1" event={event} issues={[]} assetUrls={{}} sprites={[]} onChangeEvent={setEvent} onImportSprite={async () => {}} />;
}

describe('EventInspector pages', () => {
  it('omits the top border from the first section header', () => {
    render(<Harness />);

    expect(screen.getByText('Conditions').closest('[data-slot="section-header"]')).toHaveClass('border-t-0');
    expect(screen.getByText('Autonomous Movement').closest('[data-slot="section-header"]')).not.toHaveClass('border-t-0');
  });

  it('adds, navigates, reorders and deletes inline pages', async () => {
    render(<Harness />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Add event page' }));
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: '2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Move page earlier' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Move page earlier' }));
    expect(screen.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete event page' }));
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();
  });
});
