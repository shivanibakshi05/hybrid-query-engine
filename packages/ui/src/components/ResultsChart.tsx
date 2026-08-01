import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  rows: Record<string, unknown>[];
}

export default function ResultsChart({ rows }: Props) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const xKey = cols.find(c => typeof rows[0][c] === 'string') ?? cols[0];
  const yKey = cols.find(c => typeof rows[0][c] === 'number');
  if (!yKey) return null;

  return (
    <div className="mt-6 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} labelStyle={{ color: '#F9FAFB' }} />
          <Bar dataKey={yKey} fill="#06B6D4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
