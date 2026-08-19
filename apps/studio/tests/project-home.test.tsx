import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectHome } from '../src/components/project-home';

function props() {
  return {
    recentProjects: [
      { id: 'first', gameId: 'game-one', gameVersion: '1.2.0', title: 'Forest Story', updatedAt: Date.UTC(2026, 6, 12) },
      { id: 'second', gameId: 'game-two', gameVersion: '2.0.0', title: 'Moon Keep', updatedAt: Date.UTC(2026, 7, 1) },
    ],
    loading: false,
    error: '',
    onNewProject: vi.fn(),
    onOpenArchive: vi.fn(),
    onOpenRecent: vi.fn(),
    onOpenReference: vi.fn(),
    onOpenTurnBasedReference: vi.fn(),
  };
}

describe('ProjectHome', () => {
  it('shows every recent and reference project in the page content', () => {
    render(<ProjectHome {...props()} />);

    expect(screen.getByRole('heading', { name: 'Your projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forest Story/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Moon Keep/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /La Cloche des Brumes.*Action RPG/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /La Cloche des Brumes — Turn-Based/ })).toBeInTheDocument();
  });

  it('starts a project and opens a recent project from the full-page view', async () => {
    const values = props();
    render(<ProjectHome {...values} />);

    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    await userEvent.click(screen.getByRole('button', { name: /Moon Keep/ }));

    expect(values.onNewProject).toHaveBeenCalledOnce();
    expect(values.onOpenRecent).toHaveBeenCalledWith('second');
  });
});
