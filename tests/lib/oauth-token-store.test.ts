import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { deriveKey } from '../../lib/crypto';
import { wipeAllData } from '../../lib/storage';
import { installIndexedDbMock, resetIndexedDbMock } from '../helpers/indexeddb';
import { clearOAuthTokens, loadOAuthTokens, saveOAuthTokens } from '../../lib/oauth-token-store';
import { wipeGenome } from '../../lib/genome';

describe('OAuth Token Store', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    installIndexedDbMock();
    key = await deriveKey('oauth-test', new Uint8Array(16));
  });

  beforeEach(() => {
    resetIndexedDbMock();
  });

  it('round-trips oauth tokens in the dedicated oauth store', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 12345,
    };

    await saveOAuthTokens(tokens, key);
    await expect(loadOAuthTokens(key)).resolves.toEqual(tokens);
  });

  it('wipeGenome does not clear oauth tokens', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 12345,
    };

    await saveOAuthTokens(tokens, key);
    await wipeGenome();

    await expect(loadOAuthTokens(key)).resolves.toEqual(tokens);
  });

  it('wipeAllData clears oauth tokens', async () => {
    await saveOAuthTokens(
      { accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 12345 },
      key,
    );

    await wipeAllData();

    await expect(loadOAuthTokens(key)).resolves.toBeUndefined();
  });

  it('can clear oauth tokens explicitly', async () => {
    await saveOAuthTokens(
      { accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 12345 },
      key,
    );

    await clearOAuthTokens(key);

    await expect(loadOAuthTokens(key)).resolves.toBeUndefined();
  });
});
