/**
 * components/ui/PriceChart.tsx
 * Visualizes price history.
 */
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PriceRecord } from '../../lib/price-history';

interface Props {
  data: PriceRecord[];
}

export const PriceChart: React.FC<Props> = ({ data }) => {
  const chartData = useMemo(() => {
    return data.map((record) => ({
      ...record,
      date: new Date(record.date).toLocaleDateString(),
    }));
  }, [data]);

  const trend = useMemo(() => {
    if (data.length < 2) return 0;
    const first = data[0].price;
    const last = data[data.length - 1].price;
    return ((last - first) / first) * 100;
  }, [data]);

  if (data.length === 0) return <div>No price history available.</div>;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">30-Day Price Trend</h3>
        <span className={`text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '+' : ''}
          {trend.toFixed(1)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2}
            activeDot={{ r: 6 }}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
