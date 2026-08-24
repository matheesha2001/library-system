import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function MonthlyBorrowChart({ endpoint, title = 'Monthly Borrowing Activity' }) {
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState('');
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      try {
        const res = await api.get(endpoint);
        if (!cancelled) setMonthly(res.data.monthly);
      } catch (err) {
        if (!cancelled) setError('Could not load borrowing report');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const hasActivity = monthly?.some((m) => m.count > 0);
  const maxCount = monthly ? Math.max(...monthly.map((m) => m.count)) : 0;
  const isDark = theme === 'dark';

  return (
    <div className="bg-surface dark:bg-slate-800 rounded-xl border border-outline-variant dark:border-slate-700 shadow-sm p-5 transition-colors">
      <h3 className="font-title-lg text-title-lg text-on-surface dark:text-slate-100 mb-stack-md">{title}</h3>

      {error && (
        <p className="font-body-md text-body-md text-error dark:text-rose-400">{error}</p>
      )}

      {!error && monthly === null && (
        <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">Loading chart&hellip;</p>
      )}

      {!error && monthly !== null && !hasActivity && (
        <p className="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">No borrowing activity yet</p>
      )}

      {!error && monthly !== null && hasActivity && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#c4c6cf'} />
            <XAxis
              dataKey="label"
              tick={{ fill: isDark ? '#94a3b8' : '#43474e', fontSize: 12 }}
              axisLine={{ stroke: isDark ? '#334155' : '#c4c6cf' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: isDark ? '#94a3b8' : '#43474e', fontSize: 12 }}
              axisLine={{ stroke: isDark ? '#334155' : '#c4c6cf' }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(55, 138, 221, 0.15)' : 'rgba(55, 138, 221, 0.08)' }}
              contentStyle={{
                background: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#475569' : '#c4c6cf'}`,
                borderRadius: 8,
                color: isDark ? '#f8fafc' : '#181c1e',
                fontSize: 13,
              }}
            />
            <Bar dataKey="count" name="Books borrowed" radius={[4, 4, 0, 0]}>
              {monthly.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.count === maxCount && maxCount > 0 ? '#378ADD' : isDark ? '#38bdf8' : '#85B7EB'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
