import React, { useState, useEffect } from 'react';
import { GENOME_DIMENSIONS, type Genome, type GenomeDimension } from '../../lib/types';
import { defaultGenome, saveGenome } from '../../lib/genome';
import { Slider } from '../../components/ui/Slider';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

interface OnboardingProps {
  cryptoKey: CryptoKey;
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ cryptoKey, onComplete }) => {
  const [step, setStep] = useState(0);
  const [genome, setGenome] = useState<Genome | null>(null);

  useEffect(() => {
    setGenome(defaultGenome());
  }, []);

  if (!genome) return null;

  const handleSliderChange = (dim: GenomeDimension, value: number) => {
    setGenome((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        dimensions: {
          ...prev.dimensions,
          [dim]: {
            ...prev.dimensions[dim],
            value,
          },
        },
      };
    });
  };

  const handleFinish = async () => {
    if (!genome) return;
    const finalGenome = {
      ...genome,
      isOnboarded: true,
      updatedAt: Date.now(),
    };
    await saveGenome(finalGenome, cryptoKey);
    onComplete();
  };

  return (
    <div className="p-4 max-w-md mx-auto w-full" role="main">
      {step === 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-gray-900">Welcome to SmartDeal Hunter</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Your privacy-first product scout. We help you find the best deals based on your
              personal preferences, all on-device.
            </p>
            <div className="bg-blue-50 p-3 rounded-md border border-blue-100" role="note">
              <h3 className="text-sm font-semibold text-blue-800">Privacy Note</h3>
              <p className="text-xs text-blue-700">
                Your data never leaves this device. All analysis and preference storage is encrypted
                locally using your master key.
              </p>
            </div>
            <Button onClick={() => setStep(1)} className="w-full">
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-gray-900">Your Preferences</h2>
            <p className="text-sm text-gray-500">
              Adjust these to help us find what matters to you.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-h-[350px] overflow-y-auto pr-2 space-y-5 custom-scrollbar">
              {GENOME_DIMENSIONS.map((dim) => (
                <Slider
                  key={dim}
                  id={dim}
                  label={dim.replace(/_/g, ' ')}
                  value={genome.dimensions[dim].value}
                  onChange={(val) => handleSliderChange(dim, val)}
                />
              ))}
            </div>
            <div className="flex space-x-3 pt-4">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-gray-900">All Set!</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              We&apos;ve initialized your shopping genome. You can always adjust these settings
              later in the dashboard.
            </p>
            <div className="bg-green-50 p-3 rounded-md border border-green-100">
              <p className="text-xs text-green-700">Ready to start scouting for smarter deals?</p>
            </div>
            <div className="flex space-x-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleFinish} className="flex-1">
                Finish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
