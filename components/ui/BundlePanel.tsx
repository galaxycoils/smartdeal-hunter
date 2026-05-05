import React from 'react';
import type { Bundle } from '../../lib/bundle-optimizer';
import { Card, CardContent, CardHeader } from './Card';

interface BundlePanelProps {
  bundles: Bundle[];
}

export const BundlePanel: React.FC<BundlePanelProps> = ({ bundles }) => {
  if (bundles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Bundle Recommendations</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No bundle recommendations yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bundles.map((bundle, index) => (
        <Card key={`${bundle.rationale}-${index}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Bundle {index + 1}</h2>
              <span className="text-sm text-gray-500">Score {bundle.score}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{bundle.rationale}</p>
            <div className="space-y-3">
              {bundle.items.map((item) => (
                <div
                  key={item.asin}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {typeof item.price === 'number' && (
                      <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                    )}
                  </div>
                  <span className="font-semibold">{item.individualScore}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
