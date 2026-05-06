import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { Button } from '../../../components/ui/Button';
import { Slider } from '../../../components/ui/Slider';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Alert, AlertTitle, AlertDescription } from '../../../components/ui/Alert';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Progress } from '../../../components/ui/Progress';
import { Separator } from '../../../components/ui/Separator';

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

  describe('Button variants', () => {
    it('renders each variant + size combo without crashing', () => {
      const variants = ['primary', 'secondary', 'outline', 'destructive', 'ghost', 'link'] as const;
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;
      for (const v of variants) {
        for (const s of sizes) {
          const { unmount } = render(
            <Button variant={v} size={s} disabled={s === 'icon'}>
              x
            </Button>,
          );
          unmount();
        }
      }
    });
  });

  describe('Badge', () => {
    it('renders all variants', () => {
      const variants = ['default', 'secondary', 'outline', 'success', 'warning', 'danger'] as const;
      for (const v of variants) {
        const { unmount } = render(<Badge variant={v}>tag</Badge>);
        unmount();
      }
    });
  });

  describe('Alert', () => {
    it('renders with title and description', () => {
      render(
        <Alert variant="info">
          <AlertTitle>Title</AlertTitle>
          <AlertDescription>Body</AlertDescription>
        </Alert>,
      );
      expect(screen.getByText('Title')).toBeDefined();
      expect(screen.getByText('Body')).toBeDefined();
    });
    it('renders all variants', () => {
      const variants = ['default', 'info', 'warning', 'destructive', 'success'] as const;
      for (const v of variants) {
        const { unmount } = render(<Alert variant={v}>hi</Alert>);
        unmount();
      }
    });
  });

  describe('Skeleton', () => {
    it('renders a div', () => {
      const { container } = render(<Skeleton className="h-4 w-10" />);
      expect(container.querySelector('div')).toBeDefined();
    });
  });

  describe('Progress', () => {
    it('renders with explicit value', () => {
      render(<Progress value={42} />);
      expect(screen.getByRole('progressbar')).toBeDefined();
    });
    it('renders with no value (indeterminate)', () => {
      render(<Progress />);
      expect(screen.getByRole('progressbar')).toBeDefined();
    });
  });

  describe('Separator', () => {
    it('renders horizontal default', () => {
      render(<Separator />);
    });
    it('renders vertical', () => {
      render(<Separator orientation="vertical" />);
    });
  });
});
