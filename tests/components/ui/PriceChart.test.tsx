import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PriceChart } from '../../../components/ui/PriceChart';

describe('PriceChart', () => {
  it('renders correctly with data and trend indicator', () => {
    const data = [
      { date: 1778091411794, price: 100 },
      { date: 1778091411795, price: 110 },
    ];
    render(<PriceChart data={data} />);

    expect(screen.getByText('30-Day Price Trend')).toBeDefined();
    expect(screen.getByText('+10.0%')).toBeDefined();
  });

  it('renders "No price history" when data is empty', () => {
    render(<PriceChart data={[]} />);
    expect(screen.getByText('No price history available.')).toBeDefined();
  });
});
