import { useId, type InputHTMLAttributes } from 'react';

/** Labelled input for the auth forms; the hint and error are described-by, not part of the label. */
export function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const id = input.id ?? input.name ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' bad' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <small className="hint" id={hintId}>
          {hint}
        </small>
      )}
      {error && (
        <small className="err" id={errorId}>
          {error}
        </small>
      )}
    </div>
  );
}
