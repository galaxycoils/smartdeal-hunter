/**
 * Storage layer for SmartDeal Hunter.
 * Wraps IndexedDB for local persistent storage.
 *
 * Future-version guard:
 * If a newer database version is opened by older code, reject before any reads or writes.
 */

import { encryptWithKey, decryptWithKey } from './crypto';

const DB_NAME = 'SmartDealHunterDB';
const DB_VERSION = 5;
const STORE_GENOME = 'genome';
export const STORE_PRODUCT_CACHE = 'product_cache';
export const STORE_ANALYSIS_CACHE = 'analysis_cache';
export const STORE_HISTORY_EVENTS = 'history_events';
export const STORE_OAUTH = 'oauth';
export const STORE_PRICE_ALERTS = 'price_alerts';

export class DBVersionMismatchError extends Error {
  constructor(actualVersion: number, expectedVersion: number) {
    super(`Database version ${actualVersion} is newer than supported version ${expectedVersion}`);
    this.name = 'DBVersionMismatchError';
  }
}

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
      if (!db.objectStoreNames.contains(STORE_HISTORY_EVENTS)) {
        db.createObjectStore(STORE_HISTORY_EVENTS);
      }
      if (!db.objectStoreNames.contains(STORE_OAUTH)) {
        db.createObjectStore(STORE_OAUTH);
      }
      if (!db.objectStoreNames.contains(STORE_PRICE_ALERTS)) {
        db.createObjectStore(STORE_PRICE_ALERTS);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      if (db.version > DB_VERSION) {
        reject(new DBVersionMismatchError(db.version, DB_VERSION));
        return;
      }
      resolve(db);
    };
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
 * Gets all items from a store.
 */
export async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
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
 * Retrieves and decrypts all items from a store.
 */
export async function getAllEncryptedItems<T>(
  storeName: string,
  cryptoKey: CryptoKey,
): Promise<T[]> {
  const all = await getAllItems<Uint8Array>(storeName);
  const out: T[] = [];
  for (const enc of all) {
    const json = await decryptWithKey(enc, cryptoKey);
    out.push(JSON.parse(json) as T);
  }
  return out;
}

/**
 * Clears all data from the database.
 */
export async function wipeAllData(): Promise<void> {
  const db = await getDB();
  const stores = Array.from(db.objectStoreNames);
  const transaction = db.transaction(stores, 'readwrite');

  await Promise.all([
    ...stores.map((name) => {
      return new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(name).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }),
    chrome.storage.local.remove('sdh:audit-log'),
  ]);
}
