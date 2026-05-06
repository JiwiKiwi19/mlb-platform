type MetricCardProps = {
  label: string;
  value: string;
  helperText: string;
};

export function MetricCard({ label, value, helperText }: MetricCardProps) {
  return (
    <article className="metric-card">
      <h3>{label}</h3>
      <p className="metric-value">{value}</p>
      <p className="metric-helper">{helperText}</p>
    </article>
  );
}
