import React, { useState } from 'react';
import { AmazonOAuth } from '../../lib/amazon-oauth';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';

export const DeepCheckTab: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await AmazonOAuth.connect();
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await AmazonOAuth.disconnect();
      setIsConnected(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err instanceof Error
            ? err.message
            : 'Failed'
          : 'Failed to disconnect',
      );
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
