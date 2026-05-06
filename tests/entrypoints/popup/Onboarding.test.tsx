import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Onboarding } from '../../../entrypoints/popup/Onboarding';
import * as genomeLib from '../../../lib/genome';
import { GENOME_DIMENSIONS, type Genome } from '../../../lib/types';

// Mock the genome library
vi.mock('../../../lib/genome', () => ({
  defaultGenome: vi.fn(),
  saveGenome: vi.fn(),
}));

// Mock CryptoKey
const mockCryptoKey = {} as CryptoKey;

describe('Onboarding Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(genomeLib.defaultGenome).mockReturnValue({
      version: 1,
      isOnboarded: false,
      dimensions: GENOME_DIMENSIONS.reduce(
        (acc, dim) => {
          acc[dim] = { value: 0.5, weight: 1 / GENOME_DIMENSIONS.length };
          return acc;
        },
        {} as Record<string, { value: number; weight: number }>,
      ),
      bandit: { pulls: {} as Record<string, number>, rewards: {} as Record<string, number> },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Genome);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Step 1: Welcome & Privacy', () => {
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={vi.fn()} />);

    expect(screen.getByText(/Welcome to SmartDeal Hunter/i)).toBeInTheDocument();
    expect(screen.getByText(/Your data stays local/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get started/i })).toBeInTheDocument();
  });

  it('navigates to Step 2: Preferences', async () => {
    const user = userEvent.setup();
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Get started/i }));

    expect(screen.getByText(/Your preferences/i)).toBeInTheDocument();
    // Check for 8 sliders
    GENOME_DIMENSIONS.forEach((dim) => {
      const label = dim.replace(/_/g, ' ');
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
  });

  it('updates slider values in Step 2', async () => {
    const user = userEvent.setup();
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Get started/i }));

    const firstSlider = screen.getAllByRole('slider')[0];
    fireEvent.change(firstSlider, { target: { value: '0.8' } });

    expect(firstSlider).toHaveValue('0.8');
  });

  it('navigates to Step 3: Confirmation', async () => {
    const user = userEvent.setup();
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Get started/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(screen.getByText(/All set/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finish/i })).toBeInTheDocument();
  });

  it('calls saveGenome and onComplete when finished', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /Get started/i }));

    const firstSlider = screen.getAllByRole('slider')[0];
    fireEvent.change(firstSlider, { target: { value: '0.9' } });

    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Finish/i }));

    await waitFor(() => {
      expect(genomeLib.saveGenome).toHaveBeenCalled();
      const savedGenome = vi.mocked(genomeLib.saveGenome).mock.calls[0][0];
      expect(savedGenome.isOnboarded).toBe(true);
      expect(savedGenome.dimensions[GENOME_DIMENSIONS[0]].value).toBe(0.9);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<Onboarding cryptoKey={mockCryptoKey} onComplete={vi.fn()} />);

    const startButton = screen.getByRole('button', { name: /Get started/i });
    startButton.focus();
    expect(document.activeElement).toBe(startButton);

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Your preferences/i)).toBeInTheDocument();
    });
  });
});
