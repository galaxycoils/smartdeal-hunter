/**
 * Cryptography utilities for SmartDeal Hunter.
 * Uses Web Crypto API for AES-GCM-256 encryption and PBKDF2 key derivation.
 * Derived keys are held in memory and never persisted.
 */

const ITERATIONS = 600000;
const IV_SIZE = 12; // Standard for AES-GCM
const KEY_ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const HASH_ALGO = 'SHA-256';

/**
 * Derives a cryptographic key from a password and salt.
 */
export async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    baseKey,
    { name: KEY_ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts data using AES-GCM-256 with a derived key.
 * Returns a concatenated Uint8Array: [iv(12) | ciphertext(...)]
 */
export async function encryptWithKey(data: string, key: CryptoKey): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: KEY_ALGO,
      iv,
    },
    key,
    enc.encode(data),
  );

  const result = new Uint8Array(IV_SIZE + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_SIZE);

  return result;
}

/**
 * Decrypts data encrypted by the encryptWithKey function.
 */
export async function decryptWithKey(encryptedData: Uint8Array, key: CryptoKey): Promise<string> {
  const iv = encryptedData.slice(0, IV_SIZE);
  const ciphertext = encryptedData.slice(IV_SIZE);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: KEY_ALGO,
      iv,
    },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
