declare namespace chrome {
  namespace storage {
    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }
  }

  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime?: number;
    }

    interface AlarmCreateInfo {
      when?: number;
      delayInMinutes?: number;
      periodInMinutes?: number;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;
