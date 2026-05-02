import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { Button } from '../../../components/ui/Button';
import { Slider } from '../../../components/ui/Slider';
import { Card, CardContent } from '../../../components/ui/Card';

describe('Shared UI Components', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Button', () => {
    it('renders with children', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeDefined();
    });

    it('handles click events', () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click Me</Button>);
      fireEvent.click(screen.getByText('Click Me'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Slider', () => {
    it('renders label and value', () => {
      render(<Slider id="test" label="Volume" value={0.5} onChange={() => {}} />);
      expect(screen.getByText('Volume')).toBeDefined();
      expect(screen.getByText('0.5')).toBeDefined();
    });

    it('triggers onChange when moved', () => {
      const onChange = vi.fn();
      render(<Slider id="test" label="Volume" value={0.5} onChange={onChange} />);
      const input = screen.getByLabelText('Volume');
      fireEvent.change(input, { target: { value: '0.8' } });
      expect(onChange).toHaveBeenCalledWith(0.8);
    });
  });

  describe('Card', () => {
    it('renders children correctly', () => {
      render(
        <Card>
          <CardContent>Content</CardContent>
        </Card>,
      );
      expect(screen.getByText('Content')).toBeDefined();
    });
  });
});
