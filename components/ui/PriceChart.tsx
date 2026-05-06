/**
 * components/ui/PriceChart.tsx
 * Visualizes price history.
 */
import React from 'react';
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
  if (data.length === 0) return <div>No price history available.</div>;

  const formattedData = data.map((record) => ({
    ...record,
    date: new Date(record.date).toLocaleDateString(),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="price" stroke="#8884d8" activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};
