import React, { useState, useEffect } from 'react';
import './App.css';
import { Onboarding } from './Onboarding';
import { loadGenome } from '../../lib/genome';
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
    const init = async () => {
      try {
        const salt = new Uint8Array(16); // All zeros for MVP bootstrap
        const key = await deriveKey('bootstrap-session-password', salt);
        setCryptoKey(key);

        const g = await loadGenome(key);
        setGenome(g);
      } catch (err) {
        setError('Failed to initialize secure storage');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
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

  return (
    <main className="popup-bootstrap p-4">
      <h1 className="text-xl font-bold">SmartDeal Hunter</h1>
      <p className="text-sm text-gray-600">Genome active and ready.</p>
      <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-100">
        <p className="text-xs text-green-800 font-medium">ONBOARDED ✓</p>
      </div>
      <p className="mt-4 text-xs text-gray-500 italic">Dashboard coming in P1.9.</p>
    </main>
  );
}

export default App;
