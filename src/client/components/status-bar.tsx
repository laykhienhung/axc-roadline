import type { Action, Status } from '../../shared/model';

const ORDER: Status[] = ['done', 'on_track', 'at_risk', 'behind', 'not_started'];

/** One segment per tone, sized by how many actions carry it. */
export function StatusBar({ actions }: { actions: Pick<Action, 'status'>[] }) {
  const count = (s: Status) => actions.filter((a) => a.status === s).length;
  return (
    <div className="sbar" aria-hidden="true">
      {ORDER.filter(count).map((s) => (
        <span key={s} className={`bg-${s}`} style={{ flexGrow: count(s) }} />
      ))}
    </div>
  );
}
