import React, { useState } from 'react';
import { Genome, GENOME_DIMENSIONS } from '../../lib/types';
import { validateGenome, clipAndRenormalize } from '../../lib/genome';
import { Slider } from './Slider';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';

interface GenomeTabProps {
  genome: Genome;
  onGenomeChange: (genome: Genome) => void;
}

export const GenomeTab: React.FC<GenomeTabProps> = ({ genome, onGenomeChange }) => {
  const [importJson, setImportJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleWeightChange = (dim: (typeof GENOME_DIMENSIONS)[number], newWeight: number) => {
    const updated = {
      ...genome,
      dimensions: {
        ...genome.dimensions,
        [dim]: {
          ...genome.dimensions[dim],
          weight: newWeight,
        },
      },
    };
    onGenomeChange(clipAndRenormalize(updated));
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(genome, null, 2);
    setImportJson(jsonStr);
    setError(null);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (validateGenome(parsed)) {
        onGenomeChange(clipAndRenormalize(parsed as Genome));
        setError(null);
      } else {
        setError('Invalid Genome JSON structure.');
      }
    } catch {
      setError('Invalid JSON syntax.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Genome Weights</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {GENOME_DIMENSIONS.map((dim) => (
            <Slider
              key={dim}
              id={`slider-${dim}`}
              label={dim.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              min={0}
              max={1}
              step={0.01}
              value={genome.dimensions[dim]?.weight ?? 0}
              onChange={(val) => handleWeightChange(dim, val)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">JSON Import/Export</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full h-48 p-2 font-mono text-sm border rounded-md"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste Genome JSON here..."
            data-testid="genome-json-textarea"
          />
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleImport} data-testid="import-btn">
              Import
            </Button>
            <Button variant="secondary" onClick={handleExport} data-testid="export-btn">
              Export to Editor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
