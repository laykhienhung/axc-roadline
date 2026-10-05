/** An action or objective %: a small bar plus "40%", or a muted "—" when blank. */
export function Percent({ value, width = 44 }: { value: number | null; width?: number }) {
  if (value === null) return <span className="muted">—</span>;
  const v = Math.round(value);
  return (
    <span className="pct">
      <span className="bar" style={{ width }}>
        <i style={{ width: `${v}%` }} />
      </span>
      {v}%
    </span>
  );
}
