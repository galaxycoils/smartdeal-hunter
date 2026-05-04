import { describe, it, expect } from 'vitest';
import { AmazonOAuth } from '../../lib/amazon-oauth';

describe('AmazonOAuth', () => {
  it('should generate a valid authorization URL', () => {
    const url = AmazonOAuth.getAuthUrl('https://app.com/cb', 'state123');
    const parsedUrl = new URL(url);

    expect(parsedUrl.origin + parsedUrl.pathname).toBe('https://www.amazon.com/ap/oa');
    expect(parsedUrl.searchParams.get('client_id')).toBe('amzn1.application-oa2-client.stub');
    expect(parsedUrl.searchParams.get('scope')).toBe('paapi:item-lookup');
    expect(parsedUrl.searchParams.get('response_type')).toBe('code');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://app.com/cb');
    expect(parsedUrl.searchParams.get('state')).toBe('state123');
  });

  it('should exchange code for tokens', async () => {
    const tokens = await AmazonOAuth.exchangeCode('test_code');
    expect(tokens.accessToken).toBe('access_token_for_test_code');
    expect(tokens.refreshToken).toBe('stub_refresh_token');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should throw error when exchanging empty code', async () => {
    await expect(AmazonOAuth.exchangeCode('')).rejects.toThrow('Authorization code is required');
  });

  it('should refresh tokens', async () => {
    const tokens = await AmazonOAuth.refreshTokens('old_refresh_token');
    expect(tokens.accessToken).toBe('refreshed_access_token');
    expect(tokens.refreshToken).toBe('new_stub_refresh_token');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should throw error when refreshing empty token', async () => {
    await expect(AmazonOAuth.refreshTokens('')).rejects.toThrow('Refresh token is required');
  });

  it('should connect and return tokens', async () => {
    const tokens = await AmazonOAuth.connect();
    expect(tokens.accessToken).toContain('mock_auth_code_123');
  });

  it('should disconnect successfully', async () => {
    await expect(AmazonOAuth.disconnect()).resolves.toBeUndefined();
  });
});
