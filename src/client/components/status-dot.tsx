import type { Status } from '../../shared/model';
import { STATUS_LABEL } from '../../shared/status';

/** The text shown for a status: the file's own word, or the tone's label when blank. */
export const statusText = (status: Status, word?: string) => word || STATUS_LABEL[status];

interface Props {
  status: Status;
  /** The file's word ("In progress"); defaults to the tone label. */
  word?: string;
}

export function StatusDot({ status, word, small }: Props & { small?: boolean }) {
  return (
    <span
      className={`dot${small ? ' sm' : ''} bg-${status}`}
      title={statusText(status, word)}
      data-status={status}
    />
  );
}

export function StatusLabel({ status, word }: Props) {
  return <span className={`st-lbl fg-${status}`}>{statusText(status, word)}</span>;
}

export function StatusBadge({ status, word }: Props) {
  return <span className={`badge tone-${status}`}>{statusText(status, word)}</span>;
}
