import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { GENOME_DIMENSIONS, type Genome, type GenomeDimension } from '@/lib/types';
import { defaultGenome, saveGenome } from '@/lib/genome';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  cryptoKey: CryptoKey;
  onComplete: () => void;
}

const TOTAL_STEPS = 3;

const StepDots: React.FC<{ current: number }> = ({ current }) => (
  <div
    className="flex items-center justify-center gap-1.5"
    aria-label={`Step ${current + 1} of ${TOTAL_STEPS}`}
  >
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <span
        key={i}
        className={cn(
          'h-1.5 rounded-full transition-all',
          i === current ? 'w-6 bg-primary' : 'w-1.5 bg-muted',
        )}
      />
    ))}
  </div>
);

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
    <div className="flex flex-col gap-3 p-3" role="main">
      <StepDots current={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <CardTitle>Welcome to SmartDeal Hunter</CardTitle>
            <CardDescription>
              A privacy-first product scout. Helps you find better deals using preferences scored
              entirely on your device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="info">
              <Lock />
              <AlertTitle>Your data stays local</AlertTitle>
              <AlertDescription>
                Analysis and preference storage are encrypted on your device. Nothing leaves your
                machine.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setStep(1)} className="w-full" size="lg">
              Get started <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Your preferences</CardTitle>
            <CardDescription>Drag to set what matters when scoring deals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
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
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft /> Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                Next <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <CardTitle>All set</CardTitle>
            <CardDescription>
              Your shopping genome is initialised. You can fine-tune any time from the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="success">
              <CheckCircle2 />
              <AlertDescription>Ready to start scouting for smarter deals?</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft /> Back
              </Button>
              <Button onClick={handleFinish} className="flex-1">
                Finish <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
