import { getEncryptedItem, setEncryptedItem, deleteItem, STORE_OAUTH } from './storage';
import type { AmazonOAuthTokens } from './amazon-oauth';

const TOKENS_KEY = 'tokens';

export async function loadOAuthTokens(key: CryptoKey): Promise<AmazonOAuthTokens | undefined> {
  return getEncryptedItem<AmazonOAuthTokens>(STORE_OAUTH, TOKENS_KEY, key);
}

export async function saveOAuthTokens(tokens: AmazonOAuthTokens, key: CryptoKey): Promise<void> {
  await setEncryptedItem(STORE_OAUTH, TOKENS_KEY, tokens, key);
}

export async function clearOAuthTokens(key: CryptoKey): Promise<void> {
  void key;
  await deleteItem(STORE_OAUTH, TOKENS_KEY);
}
