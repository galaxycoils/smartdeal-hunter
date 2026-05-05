import { vi } from 'vitest';

type StoreMap = Map<string, Map<string, unknown>>;

type OpenBehavior = 'success' | 'error';

interface MockDatabase {
  version: number;
  stores: StoreMap;
  failOnLowerVersion: boolean;
}

interface MockRequest<T> {
  onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null;
  onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null;
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null;
  result: T;
  error: Error | null;
}

const databases = new Map<string, MockDatabase>();
let openBehavior: OpenBehavior = 'success';
let openError: Error | null = null;

function createRequest<T>(result: T): MockRequest<T> {
  return {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result,
    error: null,
  };
}

function createObjectStoreNames(stores: StoreMap) {
  const names = Array.from(stores.keys());
  return Object.assign(names, {
    contains(name: string) {
      return stores.has(name);
    },
  });
}

function ensureStore(db: MockDatabase, name: string): Map<string, unknown> {
  const store = db.stores.get(name);
  if (!store) {
    throw new Error(`Object store ${name} does not exist`);
  }
  return store;
}

function createDbHandle(db: MockDatabase) {
  return {
    get version() {
      return db.version;
    },
    get objectStoreNames() {
      return createObjectStoreNames(db.stores);
    },
    createObjectStore(name: string) {
      if (!db.stores.has(name)) {
        db.stores.set(name, new Map());
      }
      return {};
    },
    transaction(storeNames: string | string[], _mode: string) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore(name: string) {
          if (!names.includes(name)) {
            throw new Error(`Store ${name} not in transaction scope`);
          }
          const store = ensureStore(db, name);
          return {
            put(value: unknown, key: string) {
              const req = createRequest(key);
              queueMicrotask(() => {
                store.set(key, value);
                req.onsuccess?.call(req as never, new Event('success'));
              });
              return req;
            },
            get(key: string) {
              const req = createRequest(store.get(key));
              queueMicrotask(() => {
                req.onsuccess?.call(req as never, new Event('success'));
              });
              return req;
            },
            getAll() {
              const req = createRequest(Array.from(store.values()));
              queueMicrotask(() => {
                req.onsuccess?.call(req as never, new Event('success'));
              });
              return req;
            },
            delete(key: string) {
              const req = createRequest(undefined);
              queueMicrotask(() => {
                store.delete(key);
                req.onsuccess?.call(req as never, new Event('success'));
              });
              return req;
            },
            clear() {
              const req = createRequest(undefined);
              queueMicrotask(() => {
                store.clear();
                req.onsuccess?.call(req as never, new Event('success'));
              });
              return req;
            },
          };
        },
      };
    },
    close() {},
  };
}

function open(name: string, version?: number) {
  const requestedVersion = version ?? 1;
  const existing = databases.get(name);
  const request = createRequest({} as IDBDatabase);

  queueMicrotask(() => {
    if (openBehavior === 'error') {
      request.error = openError ?? new Error('indexedDB open failed');
      request.onerror?.call(request as never, new Event('error'));
      return;
    }

    if (existing && requestedVersion < existing.version && existing.failOnLowerVersion) {
      request.error = new Error('VersionError');
      request.onerror?.call(request as never, new Event('error'));
      return;
    }

    const needsUpgrade = !existing || requestedVersion > existing.version;
    const db =
      existing ??
      ({
        version: requestedVersion,
        stores: new Map(),
        failOnLowerVersion: true,
      } satisfies MockDatabase);

    if (needsUpgrade) {
      db.version = requestedVersion;
      databases.set(name, db);
      request.result = createDbHandle(db) as never;
      request.onupgradeneeded?.call(request as never, new Event('upgradeneeded') as never);
    } else {
      request.result = createDbHandle(existing) as never;
    }

    request.onsuccess?.call(request as never, new Event('success'));
  });

  return request;
}

export function installIndexedDbMock() {
  vi.stubGlobal('indexedDB', { open: vi.fn(open) });
}

export function resetIndexedDbMock() {
  databases.clear();
  openBehavior = 'success';
  openError = null;
}

export function seedDatabase(
  name: string,
  version: number,
  stores: Record<string, Record<string, unknown>> = {},
  options: { failOnLowerVersion?: boolean } = {},
) {
  const map = new Map<string, Map<string, unknown>>();
  for (const [storeName, values] of Object.entries(stores)) {
    map.set(storeName, new Map(Object.entries(values)));
  }
  databases.set(name, {
    version,
    stores: map,
    failOnLowerVersion: options.failOnLowerVersion ?? true,
  });
}

export function getDatabaseStores(name: string) {
  return databases.get(name)?.stores;
}

export function setIndexedDbOpenError(error: Error) {
  openBehavior = 'error';
  openError = error;
}
