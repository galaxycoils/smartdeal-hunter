import { describe, it, expect, beforeAll } from 'vitest';
import { encryptWithKey, decryptWithKey, deriveKey } from '../../lib/crypto';

describe('Crypto Utilities', () => {
  const password = 'test-password-123';
  const data = 'sensitive product data';
  let sharedKey: CryptoKey;

  beforeAll(async () => {
    const salt = new Uint8Array(16);
    sharedKey = await deriveKey(password, salt);
  });

  it('should encrypt and decrypt data correctly with a key', async () => {
    const encrypted = await encryptWithKey(data, sharedKey);
    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(12); // 12 (iv) + ciphertext

    const decrypted = await decryptWithKey(encrypted, sharedKey);
    expect(decrypted).toBe(data);
  });

  it('should fail to decrypt with wrong key', async () => {
    const encrypted = await encryptWithKey(data, sharedKey);
    const wrongSalt = new Uint8Array(16);
    wrongSalt[0] = 1;
    const wrongKey = await deriveKey(password, wrongSalt);
    await expect(decryptWithKey(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should derive different keys for different salts', async () => {
    const salt1 = crypto.getRandomValues(new Uint8Array(16));
    const salt2 = crypto.getRandomValues(new Uint8Array(16));

    const key1 = await deriveKey(password, salt1);
    const key2 = await deriveKey(password, salt2);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext1 = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key1,
      new TextEncoder().encode(data),
    );
    const ciphertext2 = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key2,
      new TextEncoder().encode(data),
    );

    expect(new Uint8Array(ciphertext1)).not.toEqual(new Uint8Array(ciphertext2));
  });

  it('should produce different ciphertexts for same data and key (due to random IV)', async () => {
    const encrypted1 = await encryptWithKey(data, sharedKey);
    const encrypted2 = await encryptWithKey(data, sharedKey);

    expect(encrypted1).not.toEqual(encrypted2);

    const decrypted1 = await decryptWithKey(encrypted1, sharedKey);
    const decrypted2 = await decryptWithKey(encrypted2, sharedKey);

    expect(decrypted1).toBe(data);
    expect(decrypted2).toBe(data);
  });
});
