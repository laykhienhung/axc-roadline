import { isNextYear } from '../../shared/fiscal';
import type { Target } from '../../shared/model';
import { detailProgress } from '../../shared/progress';

const count = (n: number) => `${n} ${n === 1 ? 'action' : 'actions'}`;

/** Template 4.2 objective details (Goal · Needs first · JD); nothing for a 2.x target. */
export function ObjectiveDetails({ target }: { target: Target }) {
  const details = target.details ?? [];
  if (details.length === 0) return null;
  return (
    <section className="card details" aria-label="Objective details">
      <h2>Objective details</h2>
      {details.map((d) => {
        const n = target.actions.filter((a) => a.detailId === d.id && !isNextYear(a)).length;
        return (
          <div key={d.id} className="detail">
            <span className="did">{d.id}</span>
            <div>
              <h3>{d.title}</h3>
              {d.goal && <p className="goal">Goal: {d.goal}</p>}
              {d.needsFirst && <p className="needs">Needs first: {d.needsFirst}</p>}
              {d.jd && <p className="jd">JD: {d.jd}</p>}
            </div>
            <div className="dprog">
              <b>{Math.round(detailProgress(target, d.id))}%</b>avg · {count(n)}
            </div>
          </div>
        );
      })}
    </section>
  );
}
