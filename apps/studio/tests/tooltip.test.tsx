import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IconButtonTooltip, TooltipProvider } from '../src/components/ui/tooltip';

describe('TooltipProvider', () => {
  it('waits before opening tooltips by default', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <IconButtonTooltip label="Delayed tooltip">
          <button type="button">Target</button>
        </IconButtonTooltip>
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole('button', { name: 'Target' }));
    expect(screen.queryByText('Delayed tooltip')).not.toBeInTheDocument();
    expect(await screen.findByText('Delayed tooltip', {}, { timeout: 1_000 })).toBeInTheDocument();
  });
});
