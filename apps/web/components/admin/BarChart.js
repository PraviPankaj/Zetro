"use client";

export default function BarChart({ data, labelKey = "label", valueKey = "value" }) {
  const entries = Object.entries(data || {}).map(([label, value]) => ({ label, value }));
  if (!entries.length) {
    return <p className="text-muted small mb-0">No data yet</p>;
  }
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="bar-chart">
      {entries.map((entry) => (
        <div key={entry.label} className="bar-chart__row">
          <div className="bar-chart__label text-capitalize">{entry.label}</div>
          <div className="bar-chart__track">
            <div
              className="bar-chart__fill"
              style={{ width: `${(entry.value / max) * 100}%` }}
            />
          </div>
          <div className="bar-chart__value">{entry.value}</div>
        </div>
      ))}
    </div>
  );
}
