import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { PriceChart } from '../../../components/ui/PriceChart';

describe('PriceChart', () => {
  it('renders correctly with data', () => {
    const data = [
      { date: 1778091411794, price: 10 },
      { date: 1778091411795, price: 15 },
    ];
    const { container } = render(<PriceChart data={data} />);
    expect(container).toBeDefined();
  });

  it('renders "No price history" when data is empty', () => {
    const { getByText } = render(<PriceChart data={[]} />);
    expect(getByText('No price history available.')).toBeDefined();
  });
});
