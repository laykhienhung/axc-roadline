import { useRef } from 'react';

export const ACCEPT = '.xlsx,.csv';

const UploadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M20 21H4" />
  </svg>
);

/** A button that opens a file picker for .xlsx / .csv and hands the file over. */
export function ImportButton({
  onFile,
  disabled,
  label = 'Import workbook',
  primary = true,
  icon = true,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  primary?: boolean;
  icon?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={`btn${primary ? ' primary' : ''}`}
        disabled={disabled}
        title="Upload .xlsx / .csv — replaces the plan for everyone"
        onClick={() => input.current?.click()}
      >
        {icon && <UploadIcon />}
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        data-testid="import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
