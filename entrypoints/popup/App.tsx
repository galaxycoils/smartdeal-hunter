import React, { useState, useEffect } from 'react';
import './App.css';
import { Onboarding } from './Onboarding';
import { Dashboard } from './Dashboard';
import { loadGenome, onGenomeChange } from '../../lib/genome';
import { deriveKey } from '../../lib/crypto';
import type { Genome } from '../../lib/types';

function App() {
  const [genome, setGenome] = useState<Genome | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For Batch 3, we auto-derive a "session key" from a hardcoded salt
  // P1.13 will add the real Master Password unlock flow.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const init = async () => {
      try {
        const salt = new Uint8Array(16); // All zeros for MVP bootstrap
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
      } catch (err) {
        setError('Failed to initialize secure storage');
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleOnboardingComplete = async () => {
    if (!cryptoKey) return;
    const g = await loadGenome(cryptoKey);
    setGenome(g);
  };

  if (loading) return <div className="p-4">Initializing...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  if (!genome?.isOnboarded && cryptoKey) {
    return <Onboarding cryptoKey={cryptoKey} onComplete={handleOnboardingComplete} />;
  }

  if (genome) {
    return <Dashboard genome={genome} />;
  }

  return null;
}

export default App;
