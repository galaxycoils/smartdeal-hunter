import React, { useEffect, useState } from 'react';
import { AmazonOAuth } from '../../lib/amazon-oauth';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';

type DeepCheckStatus = 'Idle' | 'Loading' | 'Cached' | 'RateLimited' | 'OptedOut' | 'AuthError';

export const DeepCheckTab: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DeepCheckStatus>('Idle');
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      const stored = await chrome.storage.local.get([
        'sdh:deep-check-status',
        'sdh:deep-check-last-fetched',
      ]);
      if (typeof stored['sdh:deep-check-status'] === 'string') {
        setStatus(stored['sdh:deep-check-status'] as DeepCheckStatus);
      }
      if (typeof stored['sdh:deep-check-last-fetched'] === 'number') {
        setLastFetched(stored['sdh:deep-check-last-fetched']);
      }
    };
    void loadStatus();
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setStatus('Loading');
    setError(null);
    try {
      await AmazonOAuth.connect();
      setIsConnected(true);
      setStatus('Idle');
    } catch (err) {
      setStatus('AuthError');
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setStatus('Loading');
    setError(null);
    try {
      await AmazonOAuth.disconnect();
      setIsConnected(false);
      setStatus('Idle');
    } catch (err) {
      setStatus('AuthError');
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <h2 className="text-xl font-bold">Amazon Creators API</h2>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-6">
          Connect your Amazon account to enable Deep Check features. This requires the{' '}
          <strong>item-lookup</strong> scope.
        </p>

        <div className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 mb-4">
          <span className="text-sm text-gray-600">Status</span>
          <span className="font-semibold" data-testid="status-pill">
            {status}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Last fetched:{' '}
          <span data-testid="last-fetched">
            {lastFetched ? new Date(lastFetched).toLocaleString() : 'Never'}
          </span>
        </p>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4" data-testid="oauth-error">
            {error}
          </div>
        )}

        <div className="flex items-center space-x-4">
          {isConnected ? (
            <>
              <span className="text-green-600 font-semibold" data-testid="status-connected">
                Connected
              </span>
              <Button onClick={handleDisconnect} disabled={isLoading} variant="outline">
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </>
          ) : (
            <>
              <span className="text-gray-500 font-semibold" data-testid="status-disconnected">
                Not Connected
              </span>
              <Button onClick={handleConnect} disabled={isLoading} variant="primary">
                {isLoading ? 'Connecting...' : 'Connect to Amazon'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
