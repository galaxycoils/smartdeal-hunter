import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepCheckTab } from '../../../components/ui/DeepCheckTab';
import { AmazonOAuth, AmazonOAuthTokens } from '../../../lib/amazon-oauth';

// Mock the AmazonOAuth library
vi.mock('../../../lib/amazon-oauth', () => ({
  AmazonOAuth: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

describe('DeepCheckTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders disconnected state initially', () => {
    render(<DeepCheckTab />);

    expect(screen.getByText('Amazon Creators API')).toBeDefined();
    expect(screen.getByTestId('status-disconnected')).toBeDefined();
    expect(screen.getByText('Connect to Amazon')).toBeDefined();
  });

  it('loads stored status and last-fetched timestamp on mount', async () => {
    await chrome.storage.local.set({
      'sdh:deep-check-status': 'Cached',
      'sdh:deep-check-last-fetched': 1234,
    });

    render(<DeepCheckTab />);

    expect(await screen.findByTestId('status-pill')).toHaveTextContent('Cached');
    expect(screen.getByTestId('last-fetched')).not.toHaveTextContent('Never');
  });

  it('handles successful connection', async () => {
    vi.mocked(AmazonOAuth.connect).mockResolvedValueOnce({
      accessToken: 'test_token',
      refreshToken: 'test_refresh',
      expiresAt: Date.now() + 3600000,
    });

    render(<DeepCheckTab />);

    const connectButton = screen.getByText('Connect to Amazon');
    fireEvent.click(connectButton);

    // Should show loading state
    expect(screen.getByText('Connecting...')).toBeDefined();

    // Should change to connected state
    await waitFor(() => {
      expect(screen.getByTestId('status-connected')).toBeDefined();
    });

    expect(screen.getByText('Disconnect')).toBeDefined();
    expect(AmazonOAuth.connect).toHaveBeenCalledTimes(1);
  });

  it('handles connection error', async () => {
    vi.mocked(AmazonOAuth.connect).mockRejectedValueOnce(new Error('Auth failed'));

    render(<DeepCheckTab />);

    const connectButton = screen.getByText('Connect to Amazon');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByTestId('oauth-error')).toHaveTextContent('Auth failed');
    });

    // Should remain disconnected
    expect(screen.getByTestId('status-disconnected')).toBeDefined();
  });

  it('handles successful disconnection', async () => {
    // Start by connecting
    vi.mocked(AmazonOAuth.connect).mockResolvedValueOnce({} as unknown as AmazonOAuthTokens);

    render(<DeepCheckTab />);

    fireEvent.click(screen.getByText('Connect to Amazon'));

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    // Now disconnect
    vi.mocked(AmazonOAuth.disconnect).mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByText('Disconnect'));

    expect(screen.getByText('Disconnecting...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('status-disconnected')).toBeDefined();
    });

    expect(AmazonOAuth.disconnect).toHaveBeenCalledTimes(1);
  });

  it('handles disconnection error', async () => {
    // Start by connecting
    vi.mocked(AmazonOAuth.connect).mockResolvedValueOnce({} as unknown as AmazonOAuthTokens);

    render(<DeepCheckTab />);

    fireEvent.click(screen.getByText('Connect to Amazon'));

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    // Now disconnect
    vi.mocked(AmazonOAuth.disconnect).mockRejectedValueOnce(new Error('Disconnect failed'));
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-error')).toHaveTextContent('Disconnect failed');
    });

    // Should remain connected
    expect(screen.getByTestId('status-connected')).toBeDefined();
  });

  it('falls back to a generic disconnect error for non-Error throwables', async () => {
    vi.mocked(AmazonOAuth.connect).mockResolvedValueOnce({} as unknown as AmazonOAuthTokens);

    render(<DeepCheckTab />);

    fireEvent.click(screen.getByText('Connect to Amazon'));
    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    vi.mocked(AmazonOAuth.disconnect).mockRejectedValueOnce('bad');
    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(screen.getByTestId('oauth-error')).toHaveTextContent('Failed to disconnect');
    });
  });
});
