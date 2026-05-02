import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScoutPanel } from '../../../components/ui/ScoutPanel';

describe('ScoutPanel', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    asin: 'B012345678',
    trueValue: 85,
    personalFit: 92,
    onClose: vi.fn(),
  };

  it('renders scores correctly', () => {
    render(<ScoutPanel {...defaultProps} />);

    expect(screen.getByText('True Value')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();

    expect(screen.getByText('Personal Fit')).toBeTruthy();
    expect(screen.getByText('92')).toBeTruthy();
  });

  it('renders feedback buttons', () => {
    render(<ScoutPanel {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Not Interested' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Purchased' })).toBeTruthy();
  });

  it('triggers onClose when close button is clicked', () => {
    render(<ScoutPanel {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onFeedback when feedback buttons are clicked', () => {
    const onFeedback = vi.fn();
    render(<ScoutPanel {...defaultProps} onFeedback={onFeedback} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not Interested' }));
    expect(onFeedback).toHaveBeenCalledWith('not_interested');

    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    expect(onFeedback).toHaveBeenCalledWith('saved');

    fireEvent.click(screen.getByRole('button', { name: 'Purchased' }));
    expect(onFeedback).toHaveBeenCalledWith('purchased');
  });
});
