import React, { useState, useEffect } from 'react';
import './App.css';
import { Loader2 } from 'lucide-react';
import { Onboarding } from './Onboarding';
import { Dashboard } from './Dashboard';
import { Toaster } from '@/components/ui/Sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { loadGenome, onGenomeChange } from '@/lib/genome';
import { deriveKey } from '@/lib/crypto';
import type { Genome } from '@/lib/types';

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-xs">Initializing secure storage…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <AlertTitle>Initialization failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      {!genome?.isOnboarded && cryptoKey ? (
        <Onboarding cryptoKey={cryptoKey} onComplete={handleOnboardingComplete} />
      ) : genome ? (
        <Dashboard genome={genome} />
      ) : null}
      <Toaster />
    </>
  );
}

export default App;
