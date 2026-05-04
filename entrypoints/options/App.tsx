import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { GenomeTab } from '../../components/ui/GenomeTab';
import { DeepCheckTab } from '../../components/ui/DeepCheckTab';
import { loadGenome } from '../../lib/genome';
import { Genome } from '../../lib/types';
import { wipeAllData } from '../../lib/storage';
import { deriveKey } from '../../lib/crypto';

function PrivacyTab() {
  const [wipeSuccess, setWipeSuccess] = useState(false);

  const handleExport = async () => {
    try {
      const salt = new Uint8Array(16);
      const key = await deriveKey('bootstrap-session-password', salt);
      const genome = await loadGenome(key);

      const blob = new Blob([JSON.stringify(genome, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartdeal-genome-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
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
      setWipeSuccess(true);
      setTimeout(() => setWipeSuccess(false), 5000);
    } catch (err) {
      console.error('Wipe failed:', err);
      alert('Failed to wipe data.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Privacy & Compliance</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
            <p className="font-bold mb-1">Compliance Notice</p>
            <p>
              SmartDeal Hunter is designed with a privacy-first architecture. All your shopping
              data, product analysis, and your &quot;Shopping Genome&quot; stay strictly on this
              device. We do not use silent tracking, and no data is ever uploaded to our servers.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-medium mb-2">Export Your Data</h3>
              <p className="text-sm text-gray-600 mb-3">
                Download a copy of your Shopping Genome in JSON format.
              </p>
              <Button variant="outline" onClick={handleExport}>
                Export Genome
              </Button>
            </div>

            <hr className="border-gray-100" />

            <div>
              <h3 className="font-medium mb-2 text-red-600">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-3">
                Permanently delete all data stored by this extension, including your genome and
                cached products.
              </p>
              <Button
                variant="secondary"
                className="text-red-600 border-red-200"
                onClick={handleWipe}
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
        </div>
      </CardContent>
    </Card>
  );
}

export function App() {
  const tabs = [
    {
      id: 'settings',
      label: 'Settings',
      content: (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500">Settings coming soon...</p>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'privacy',
      label: 'Privacy',
      content: <PrivacyTab />,
    },
    {
      id: 'genome',
      label: 'Genome',
      content: (
        <GenomeTab
          genome={
            {
              version: 1,
              lastUpdated: 0,
              sessionId: '',
              encryptionSalt: '',
              createdAt: 0,
              dimensions: {},
            } as unknown as Genome
          }
          onGenomeChange={() => {}}
        />
      ),
    },
    {
      id: 'deepcheck',
      label: 'DeepCheck',
      content: <DeepCheckTab />,
    },
    {
      id: 'about',
      label: 'About',
      content: (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500">About SmartDeal Hunter...</p>
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">SmartDeal Hunter Settings</h1>

      <Tabs tabs={tabs} defaultTab="privacy" />

      <footer className="text-center text-gray-400 text-xs mt-8">
        <p>SmartDeal Hunter v{browser.runtime.getManifest().version}</p>
      </footer>
    </main>
  );
}
