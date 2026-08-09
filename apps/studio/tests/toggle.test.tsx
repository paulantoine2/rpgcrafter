import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toggle } from '../src/components/ui/toggle';

describe('Toggle', () => {
  it('uses the subtle global primary selected background', () => {
    render(<Toggle pressed aria-label="Selected toggle"><span className="text-muted-foreground">Value</span></Toggle>);

    const toggle = screen.getByRole('button', { name: 'Selected toggle' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveClass('aria-pressed:bg-primary/50');
  });
});
