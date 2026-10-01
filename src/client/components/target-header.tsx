import type { Plan, Target, Ymd } from '../../shared/model';
import { nextActions } from '../../shared/next-actions';
import { progress } from '../../shared/progress';
import { dueShort, percent } from '../format';
import { StatusBadge } from './status-dot';

export function TargetHeader({ plan, target, today }: { plan: Plan; target: Target; today: Ymd }) {
  const { done, total, nextYear } = progress(target);
  const open = nextActions(plan, today, { limit: Infinity, targetId: target.id });
  const overdue = open.filter((n) => n.overdue).length;
  const next = open.slice(0, 3);
  return (
    <section className="card target-card" aria-label="Target">
      <div className="t-main">
        <div className="tags">
          <span className="chip">{target.id}</span>
          <StatusBadge status={target.status} word={target.statusWord} />
        </div>
        <h1>{target.name}</h1>
        {target.objective && <p className="obj">{target.objective}</p>}
        <div className="facts">
          <div className="fact">
            Weight<b>{percent(target.weight)}</b>
          </div>
          <div className="fact">
            Owner<b className="plain">{target.owner || '—'}</b>
          </div>
          <div className="fact">
            This year’s progress
            <b>
              {done} <span className="of">/ {total} done</span>
            </b>
            <div className="pbar">
              <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
            </div>
            {nextYear > 0 && <small>this year · {nextYear} more next year</small>}
          </div>
          <div className={`fact${overdue ? ' bad' : ''}`}>
            Overdue<b>{overdue}</b>
          </div>
        </div>
      </div>
      <aside className="next-t" aria-label="Next for this target">
        <h2>Next for this target</h2>
        {next.length ? (
          <ol>
            {next.map((n) => (
              <li key={n.action.no}>
                <span className="top">
                  <span className="no">#{n.action.no}</span>
                  <StatusBadge status={n.action.status} word={n.action.statusWord} />
                  <span className={`due${n.overdue ? ' late' : ''}`}>{dueShort(n)}</span>
                </span>
                <b>{n.action.deliverable || n.action.action}</b>
                <small>{n.action.owner}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Nothing open — every action is done.</p>
        )}
      </aside>
    </section>
  );
}
