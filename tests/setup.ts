import { vi, afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

type StorageRecord = Record<string, unknown>;
type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;
type AlarmListener = (alarm: chrome.alarms.Alarm) => void;

const localStorageState: StorageRecord = {};
const storageListeners = new Set<StorageListener>();
const alarmListeners = new Set<AlarmListener>();
const scheduledAlarms = new Map<string, chrome.alarms.AlarmCreateInfo | undefined>();

const storageArea = {
  get: vi.fn(async (keys?: null | string | string[] | StorageRecord) => {
    if (keys == null) {
      return { ...localStorageState };
    }
    if (typeof keys === 'string') {
      return keys in localStorageState ? { [keys]: localStorageState[keys] } : {};
    }
    if (Array.isArray(keys)) {
      return keys.reduce<StorageRecord>((acc, key) => {
        if (key in localStorageState) acc[key] = localStorageState[key];
        return acc;
      }, {});
    }
    return Object.entries(keys).reduce<StorageRecord>((acc, [key, fallback]) => {
      acc[key] = key in localStorageState ? localStorageState[key] : fallback;
      return acc;
    }, {});
  }),
  set: vi.fn(async (items: StorageRecord) => {
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: localStorageState[key], newValue: value };
      localStorageState[key] = value;
    }
    for (const listener of storageListeners) {
      listener(changes, 'local');
    }
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const key of list) {
      if (key in localStorageState) {
        changes[key] = { oldValue: localStorageState[key], newValue: undefined };
        delete localStorageState[key];
      }
    }
    if (Object.keys(changes).length > 0) {
      for (const listener of storageListeners) {
        listener(changes, 'local');
      }
    }
  }),
  clear: vi.fn(async () => {
    const changes = Object.keys(localStorageState).reduce<
      Record<string, chrome.storage.StorageChange>
    >((acc, key) => {
      acc[key] = { oldValue: localStorageState[key], newValue: undefined };
      return acc;
    }, {});
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key];
    }
    if (Object.keys(changes).length > 0) {
      for (const listener of storageListeners) {
        listener(changes, 'local');
      }
    }
  }),
};

const mockBrowser = {
  runtime: {
    id: 'test-extension-id',
    getContexts: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
    getManifest: vi.fn(() => ({ version: '0.0.1' })),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    ContextType: {
      OFFSCREEN: 'OFFSCREEN',
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  offscreen: {
    createDocument: vi.fn(),
    closeDocument: vi.fn(),
    Reason: {
      LOCAL_STORAGE: 'LOCAL_STORAGE',
      DOM_PARSER: 'DOM_PARSER',
    },
  },
  storage: {
    local: storageArea,
    onChanged: {
      addListener: vi.fn((listener: StorageListener) => {
        storageListeners.add(listener);
      }),
      removeListener: vi.fn((listener: StorageListener) => {
        storageListeners.delete(listener);
      }),
    },
  },
  alarms: {
    create: vi.fn(async (name: string, alarmInfo?: chrome.alarms.AlarmCreateInfo) => {
      scheduledAlarms.set(name, alarmInfo);
    }),
    clear: vi.fn(async (name: string) => {
      return scheduledAlarms.delete(name);
    }),
    onAlarm: {
      addListener: vi.fn((listener: AlarmListener) => {
        alarmListeners.add(listener);
      }),
      removeListener: vi.fn((listener: AlarmListener) => {
        alarmListeners.delete(listener);
      }),
    },
  },
};

vi.stubGlobal('browser', mockBrowser);
vi.stubGlobal('chrome', mockBrowser);
vi.stubGlobal('__chromeTestHarness', {
  getAlarmListeners: () => Array.from(alarmListeners),
});

beforeEach(() => {
  for (const key of Object.keys(localStorageState)) {
    delete localStorageState[key];
  }
  storageListeners.clear();
  alarmListeners.clear();
  scheduledAlarms.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});
