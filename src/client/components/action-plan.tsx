import { compareYmd, isNextYear, nextFiscalLabel, quarterColumns } from '../../shared/fiscal';
import type { Action, Plan, Quarter, Target, Ymd } from '../../shared/model';
import { nextDate } from '../../shared/next-actions';
import { dueLong, dueShort } from '../format';
import { Percent } from './percent';
import { StatusBadge } from './status-dot';

/** "📎 a · b · +n": the first two reference names, then how many more. */
export function refLine(refs: string[]): string {
  const more = refs.length > 2 ? ` · +${refs.length - 2}` : '';
  return `📎 ${refs.slice(0, 2).join(' · ')}${more}`;
}

function ActionTable({ plan, actions, today }: { plan: Plan; actions: Action[]; today: Ymd }) {
  const partners = plan.targets.some((t) => t.actions.some((a) => a.partners));
  const pct = plan.progressBy === 'percent';
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Action</th>
          {partners ? (
            <th style={{ width: 170 }}>Partners</th>
          ) : (
            <th style={{ width: 230 }}>Success measure</th>
          )}
          <th style={{ width: 112 }}>Owner</th>
          <th style={{ width: 96 }}>Due</th>
          {pct && <th style={{ width: 96 }}>%</th>}
          <th style={{ width: 120 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {actions.map((a) => {
          const overdue =
            a.status !== 'done' &&
            !isNextYear(a) &&
            compareYmd(nextDate(plan, a, today), today) < 0;
          return (
            <tr key={a.no} className={a.status === 'done' ? 'done' : undefined}>
              <td className="n">{a.no}</td>
              <td>
                <div className="act">
                  {a.detailId && <span className="dchip">{a.detailId}</span>}
                  {a.action}
                </div>
                {a.deliverable !== a.action && <div className="sub">→ {a.deliverable}</div>}
                {a.references && a.references.length > 0 && (
                  <div className="ref">{refLine(a.references)}</div>
                )}
                {a.note && <div className="note">{a.note}</div>}
              </td>
              <td className="measure">{partners ? a.partners || '—' : (a.measure ?? '—')}</td>
              <td className="own">{a.owner}</td>
              <td className={`when${overdue ? ' late' : ''}`}>
                {overdue ? dueShort({ action: a, overdue }) : dueLong(a)}
              </td>
              {pct && (
                <td>
                  <Percent value={a.percent ?? null} />
                </td>
              )}
              <td>
                <StatusBadge status={a.status} word={a.statusWord} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const count = (n: number) => `${n} ${n === 1 ? 'action' : 'actions'}`;

export function ActionPlan({
  plan,
  target,
  currentQuarter,
  today,
}: {
  plan: Plan;
  target: Target;
  currentQuarter: Quarter | null;
  today: Ymd;
}) {
  const ongoing = target.actions.filter((a) => a.quarter === 'ongoing');
  const nextYear = target.actions.filter(isNextYear);
  const sections = target.details?.length
    ? target.details.map((d) => `${d.id} ${d.title}`)
    : [...new Set(target.actions.map((a) => a.section).filter(Boolean))];
  return (
    <section className="card ap" aria-label="Action plan">
      <div className="ap-h">
        <h2>Action plan</h2>
        <small>
          {count(target.actions.length)}
          {sections.length > 1 ? ` · ${sections.join(' · ')}` : ''}
        </small>
      </div>
      {quarterColumns(plan).map((q) => {
        const actions = target.actions.filter((a) => a.quarter === q.quarter);
        const now = q.quarter === currentQuarter;
        return (
          <div key={q.quarter} className={`q${now ? ' now' : ''}`} data-quarter={q.quarter}>
            <div className="q-h" id={q.quarter.toLowerCase()}>
              <h3>{q.quarter}</h3>
              <small>
                {q.range} · {count(actions.length)}
              </small>
              {now && <span className="now-pill">NOW</span>}
            </div>
            {actions.length ? (
              <ActionTable plan={plan} actions={actions} today={today} />
            ) : (
              <p className="hint">No actions this quarter.</p>
            )}
          </div>
        );
      })}
      {ongoing.length > 0 && (
        <div className="q" data-quarter="ongoing">
          <div className="q-h" id="ongoing">
            <h3>All year</h3>
            <small>ongoing · {count(ongoing.length)}</small>
          </div>
          <ActionTable plan={plan} actions={ongoing} today={today} />
        </div>
      )}
      {nextYear.length > 0 && (
        <div className="q ny" data-quarter="next_year">
          <div className="q-h" id="next_year">
            <h3>Next year</h3>{' '}
            <small>
              {nextFiscalLabel(plan)} · {count(nextYear.length)}
            </small>
            <span className="ny-tag">not in this year’s progress</span>
          </div>
          <p className="hint">Moved to the next fiscal year in the file.</p>
          <ActionTable plan={plan} actions={nextYear} today={today} />
        </div>
      )}
    </section>
  );
}
