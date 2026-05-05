import React, { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Card, CardContent } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { GenomeTab } from '../../components/ui/GenomeTab';
import { DeepCheckTab } from '../../components/ui/DeepCheckTab';
import { PrivacyTab } from '../../components/ui/PrivacyTab';
import { defaultGenome, loadGenome, onGenomeChange, saveGenome } from '../../lib/genome';
import { Genome } from '../../lib/types';
import { deriveKey } from '../../lib/crypto';

export function App() {
  const [genome, setGenome] = useState<Genome>(defaultGenome());
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const init = async () => {
      const salt = new Uint8Array(16);
      const key = await deriveKey('bootstrap-session-password', salt);
      if (cancelled) return;
      setCryptoKey(key);

      const refreshGenome = async () => {
        const nextGenome = await loadGenome(key);
        if (!cancelled) {
          setGenome(nextGenome);
        }
      };

      await refreshGenome();
      unsubscribe = onGenomeChange(() => {
        void refreshGenome();
      });
    };

    void init();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleGenomeChange = async (nextGenome: Genome) => {
    setGenome(nextGenome);
    if (!cryptoKey) return;
    await saveGenome(nextGenome, cryptoKey, {
      expectedRevision: genome.revision,
    });
    setGenome(await loadGenome(cryptoKey));
  };

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
          genome={genome}
          onGenomeChange={(nextGenome) => void handleGenomeChange(nextGenome)}
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
