export interface AmazonOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AmazonOAuth {
  private static CLIENT_ID = 'amzn1.application-oa2-client.stub';
  private static SCOPE = 'paapi:item-lookup';
  private static AUTH_URL = 'https://www.amazon.com/ap/oa';

  static getAuthUrl(redirectUri: string, state: string): string {
    const url = new URL(this.AUTH_URL);
    url.searchParams.append('client_id', this.CLIENT_ID);
    url.searchParams.append('scope', this.SCOPE);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('state', state);
    return url.toString();
  }

  static async exchangeCode(code: string): Promise<AmazonOAuthTokens> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Stub implementation
    return {
      accessToken: `access_token_for_${code}`,
      refreshToken: 'stub_refresh_token',
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  static async refreshTokens(refreshToken: string): Promise<AmazonOAuthTokens> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    // Stub implementation
    return {
      accessToken: `refreshed_access_token`,
      refreshToken: 'new_stub_refresh_token',
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  static async connect(): Promise<AmazonOAuthTokens> {
    // Simulating connection for the UI
    const mockCode = 'mock_auth_code_123';
    return this.exchangeCode(mockCode);
  }

  static async disconnect(): Promise<void> {
    // Stub for revoking tokens or clearing local storage
    return Promise.resolve();
  }
}
