import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenomeTab } from '../../../components/ui/GenomeTab';
import { defaultGenome } from '../../../lib/genome';
import { Genome } from '../../../lib/types';

describe('GenomeTab', () => {
  let mockGenome: Genome;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockGenome = defaultGenome(() => 1000);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sliders for all dimensions', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    expect(screen.getByText('Price Sensitivity')).toBeDefined();
    expect(screen.getByText('Brand Affinity')).toBeDefined();
    // check that there are multiple sliders
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('calls onGenomeChange when a slider is moved', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    const slider = screen.getByLabelText('Price Sensitivity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });

    expect(mockOnChange).toHaveBeenCalled();
    const updatedGenome = mockOnChange.mock.calls[0][0];
    expect(updatedGenome.dimensions.price_sensitivity.weight).toBeGreaterThan(0.125);
  });

  it('exports genome to textarea when Export button is clicked', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    const textarea = screen.getByTestId('genome-json-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"version": 1');
    expect(textarea.value).toContain('"price_sensitivity"');
  });

  it('imports genome from textarea and calls onGenomeChange on success', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    const textarea = screen.getByTestId('genome-json-textarea') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    // Valid import
    const newGenome = defaultGenome(() => 2000);
    newGenome.isOnboarded = true; // Make it slightly different
    fireEvent.change(textarea, { target: { value: JSON.stringify(newGenome) } });
    fireEvent.click(importBtn);

    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange.mock.calls[0][0].isOnboarded).toBe(true);
    expect(screen.queryByText('Invalid Genome JSON structure.')).toBeNull();
  });

  it('shows error on invalid JSON syntax', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    const textarea = screen.getByTestId('genome-json-textarea') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    fireEvent.change(textarea, { target: { value: 'invalid json' } });
    fireEvent.click(importBtn);

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid JSON syntax.')).toBeDefined();
  });

  it('shows error on invalid Genome structure', () => {
    render(<GenomeTab genome={mockGenome} onGenomeChange={mockOnChange} />);
    const textarea = screen.getByTestId('genome-json-textarea') as HTMLTextAreaElement;
    const importBtn = screen.getByTestId('import-btn');

    fireEvent.change(textarea, { target: { value: '{"version": 999}' } });
    fireEvent.click(importBtn);

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid Genome JSON structure.')).toBeDefined();
  });
});
