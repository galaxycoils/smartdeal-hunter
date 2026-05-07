import React, { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';
import { loadGenome } from '../../lib/genome';
import { deriveKey } from '../../lib/crypto';
import { wipeAllData } from '../../lib/storage';
import { getAuditLogEntries, type AuditLogEntry } from '../../lib/audit-log';
import type { ListEnrolledAlertsResponse } from '../../lib/messaging/types';

type PrivacySettings = {
  optInDeepCheck: boolean;
  optInAuditLog: boolean;
  optInGenomeSync: boolean;
};

const DEFAULT_SETTINGS: PrivacySettings = {
  optInDeepCheck: false,
  optInAuditLog: false,
  optInGenomeSync: false,
};

export const PrivacyTab: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [wipeSuccess, setWipeSuccess] = useState(false);
  const [scheduleSeconds, setScheduleSeconds] = useState('5');
  const [enrolledAsins, setEnrolledAsins] = useState<string[]>([]);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied'>('granted');

  const refreshEnrollments = async () => {
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'LIST_ENROLLED_ALERTS',
      })) as ListEnrolledAlertsResponse | undefined;
      if (res?.type === 'ENROLLED_ALERTS') {
        setEnrolledAsins(res.payload.asins);
      }
    } catch {
      /* ignore */
    }
  };

  const handleUnenroll = async (asin: string) => {
    setEnrolledAsins((prev) => prev.filter((a) => a !== asin));
    try {
      await browser.runtime.sendMessage({ type: 'DISENROLL_ALERT', payload: { asin } });
    } catch {
      void refreshEnrollments();
    }
  };

  useEffect(() => {
    void refreshEnrollments();
    void (async () => {
      try {
        const level = await chrome.notifications.getPermissionLevel();
        setNotifPermission(level === 'denied' ? 'denied' : 'granted');
      } catch {
        /* keep default */
      }
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
      setSettings({
        optInDeepCheck: Boolean(stored.optInDeepCheck),
        optInAuditLog: Boolean(stored.optInAuditLog),
        optInGenomeSync: Boolean(stored.optInGenomeSync),
      });
      setAuditEntries(await getAuditLogEntries());
    };
    void load();
  }, []);

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await chrome.storage.local.set({ [key]: value });
  };

  const handleExport = async () => {
    try {
      const salt = new Uint8Array(16);
      const key = await deriveKey('bootstrap-session-password', salt);
      const genome = await loadGenome(key);
      const blob = new Blob([JSON.stringify(genome, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'smartdeal-genome-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data.');
    }
  };

  const handleWipe = async () => {
    if (!window.confirm('Are you sure you want to wipe all data? This cannot be undone.')) {
      return;
    }

    try {
      await wipeAllData();
      await browser.runtime.sendMessage({ type: 'DATA_WIPED' });
      setAuditEntries([]);
      setEnrolledAsins([]);
      setWipeSuccess(true);
      setTimeout(() => setWipeSuccess(false), 5_000);
    } catch (error) {
      console.error('Wipe failed:', error);
      alert('Failed to wipe data.');
    }
  };

  const handleScheduleWipe = async () => {
    const seconds = Math.max(1, Number(scheduleSeconds) || 5);
    await chrome.alarms.create('sdh:scheduled-wipe', { when: Date.now() + seconds * 1_000 });
    await chrome.storage.local.set({ 'sdh:scheduled-wipe': Date.now() + seconds * 1_000 });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Privacy & Compliance</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
            <p className="font-bold mb-1">Compliance Notice</p>
            <p>
              SmartDeal Hunter is designed with a privacy-first architecture. All your shopping
              data, product analysis, and your Shopping Genome stay strictly on this device.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4">
              <span>Enable Deep Check</span>
              <input
                type="checkbox"
                aria-label="Enable Deep Check"
                checked={settings.optInDeepCheck}
                onChange={(event) => void updateSetting('optInDeepCheck', event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Enable Audit Log</span>
              <input
                type="checkbox"
                aria-label="Enable Audit Log"
                checked={settings.optInAuditLog}
                onChange={(event) => void updateSetting('optInAuditLog', event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Enable Genome Sync</span>
              <input
                type="checkbox"
                aria-label="Enable Genome Sync"
                checked={settings.optInGenomeSync}
                onChange={(event) => void updateSetting('optInGenomeSync', event.target.checked)}
              />
            </label>
          </div>

          {!settings.optInAuditLog && auditEntries.length > 0 && (
            <p className="text-sm text-amber-700">
              Audit log paused. Existing entries retained. Use Wipe All Data to clear.
            </p>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">Audit Log</h3>
            <div className="rounded border border-gray-200 p-3 text-sm space-y-2">
              {auditEntries.length === 0 ? (
                <p className="text-gray-500">No audit log entries yet.</p>
              ) : (
                auditEntries.map((entry) => (
                  <div key={`${entry.ts}-${entry.summary}`} className="flex justify-between gap-4">
                    <span>{entry.summary}</span>
                    <span className="text-gray-500">{entry.kind}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Price alerts</h3>
            <p
              className={`text-sm ${
                notifPermission === 'denied' ? 'text-red-700' : 'text-green-700'
              }`}
            >
              {notifPermission === 'denied'
                ? 'Notifications: blocked by OS'
                : 'Notifications: allowed'}
            </p>
            <div className="rounded border border-gray-200 p-3 text-sm space-y-2">
              {enrolledAsins.length === 0 ? (
                <p className="text-gray-500">No alerts enrolled yet.</p>
              ) : (
                enrolledAsins.map((asin) => (
                  <div key={asin} className="flex justify-between items-center gap-4">
                    <span className="font-mono">{asin}</span>
                    <Button
                      variant="outline"
                      className="text-xs py-1 px-2"
                      onClick={() => void handleUnenroll(asin)}
                    >
                      Un-enroll
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Export Your Data</h3>
            <Button variant="outline" onClick={() => void handleExport()}>
              Export Genome
            </Button>
          </div>

          <div className="space-y-2">
            <label className="flex flex-col gap-2">
              <span className="font-medium">Schedule wipe in seconds</span>
              <input
                type="number"
                min="1"
                aria-label="Schedule wipe in seconds"
                value={scheduleSeconds}
                onChange={(event) => setScheduleSeconds(event.target.value)}
                className="border rounded px-3 py-2"
              />
            </label>
            <Button variant="outline" onClick={() => void handleScheduleWipe()}>
              Schedule Wipe
            </Button>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-red-600">Danger Zone</h3>
            <Button
              variant="secondary"
              className="text-red-600 border-red-200"
              onClick={() => void handleWipe()}
            >
              Wipe All Data
            </Button>
            {wipeSuccess && (
              <p className="mt-2 text-sm text-green-600 font-medium">
                All data has been successfully wiped.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
