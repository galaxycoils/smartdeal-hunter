import React from 'react';
import { browser } from 'wxt/browser';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import type { Genome } from '../../lib/types';
import type { ScrapeRequest } from '../../lib/messaging/types';

interface DashboardProps {
  genome: Genome;
}

export const Dashboard: React.FC<DashboardProps> = ({ genome }) => {
  const handleQuickScout = async () => {
    const message: ScrapeRequest = { type: 'SCRAPE_REQUEST' };
    await browser.runtime.sendMessage(message);
  };

  // Get top 3 highest weighted dimensions
  const topDimensions = Object.entries(genome.dimensions)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 3)
    .map(([dim, state]) => ({
      name: dim.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      weight: state.weight,
    }));

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">SmartDeal Hunter</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-800">Genome Summary</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-2">Top Priorities:</p>
            {topDimensions.map((dim) => (
              <div key={dim.name} className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700">{dim.name}</span>
                <span className="text-gray-500">{(dim.weight * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleQuickScout} className="w-full">
          Quick Scout
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-800">Recent Analyses</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 italic text-center py-4">No recent analyses found.</p>
        </CardContent>
      </Card>
    </div>
  );
};
