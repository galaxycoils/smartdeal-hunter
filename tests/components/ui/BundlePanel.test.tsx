import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BundlePanel } from '../../../components/ui/BundlePanel';
import type { Bundle } from '../../../lib/bundle-optimizer';

describe('BundlePanel', () => {
  it('renders an empty state when there are no bundles', () => {
    render(<BundlePanel bundles={[]} />);

    expect(screen.getByText('No bundle recommendations yet.')).toBeInTheDocument();
  });

  it('renders a single bundle with rationale and item scores', () => {
    const bundles: Bundle[] = [
      {
        score: 88,
        rationale: 'Picked using your quality priority and brand affinity preferences.',
        items: [
          { asin: 'A1', title: 'Bundle Item 1', price: 19.99, individualScore: 91 },
          { asin: 'A2', title: 'Bundle Item 2', price: 9.99, individualScore: 85 },
        ],
      },
    ];

    render(<BundlePanel bundles={bundles} />);

    expect(screen.getByText('Bundle Item 1')).toBeInTheDocument();
    expect(screen.getByText('Bundle Item 2')).toBeInTheDocument();
    expect(
      screen.getByText('Picked using your quality priority and brand affinity preferences.'),
    ).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders three bundles', () => {
    const bundles: Bundle[] = [
      {
        score: 90,
        rationale: 'First rationale',
        items: [{ asin: 'A1', title: 'First', individualScore: 90 }],
      },
      {
        score: 80,
        rationale: 'Second rationale',
        items: [{ asin: 'A2', title: 'Second', individualScore: 80 }],
      },
      {
        score: 70,
        rationale: 'Third rationale',
        items: [{ asin: 'A3', title: 'Third', individualScore: 70 }],
      },
    ];

    render(<BundlePanel bundles={bundles} />);

    expect(screen.getByText('First rationale')).toBeInTheDocument();
    expect(screen.getByText('Second rationale')).toBeInTheDocument();
    expect(screen.getByText('Third rationale')).toBeInTheDocument();
  });
});
