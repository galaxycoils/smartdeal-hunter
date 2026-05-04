/**
 * Storage layer for SmartDeal Hunter.
 * Wraps IndexedDB for local persistent storage.
 */

import { encryptWithKey, decryptWithKey } from './crypto';

const DB_NAME = 'SmartDealHunterDB';
const DB_VERSION = 2;
const STORE_GENOME = 'genome';
export const STORE_PRODUCT_CACHE = 'product_cache';
export const STORE_ANALYSIS_CACHE = 'analysis_cache';

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Initializes the IndexedDB database.
 */
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_GENOME)) {
        db.createObjectStore(STORE_GENOME);
      }
      if (!db.objectStoreNames.contains(STORE_PRODUCT_CACHE)) {
        db.createObjectStore(STORE_PRODUCT_CACHE);
      }
      if (!db.objectStoreNames.contains(STORE_ANALYSIS_CACHE)) {
        db.createObjectStore(STORE_ANALYSIS_CACHE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sets an item in a store.
 */
export async function setItem<T>(storeName: string, key: string, value: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets an item from a store.
 */
export async function getItem<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes an item from a store.
 */
export async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores encrypted data.
 */
export async function setEncryptedItem<T>(
  storeName: string,
  key: string,
  value: T,
  cryptoKey: CryptoKey,
): Promise<void> {
  const jsonString = JSON.stringify(value);
  const encrypted = await encryptWithKey(jsonString, cryptoKey);
  await setItem(storeName, key, encrypted);
}

/**
 * Retrieves and decrypts data.
 */
export async function getEncryptedItem<T>(
  storeName: string,
  key: string,
  cryptoKey: CryptoKey,
): Promise<T | undefined> {
  const encrypted = await getItem<Uint8Array>(storeName, key);
  if (!encrypted) return undefined;

  const jsonString = await decryptWithKey(encrypted, cryptoKey);
  return JSON.parse(jsonString) as T;
}

/**
 * Clears all data from the database.
 */
export async function wipeAllData(): Promise<void> {
  const db = await getDB();
  const stores = Array.from(db.objectStoreNames);
  const transaction = db.transaction(stores, 'readwrite');

  await Promise.all(
    stores.map((name) => {
      return new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(name).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }),
  );
}
