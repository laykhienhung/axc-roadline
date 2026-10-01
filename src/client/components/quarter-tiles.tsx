import { compareYmd, isNextYear, quarterColumns } from '../../shared/fiscal';
import type { Action, Plan, Quarter, Target, Ymd } from '../../shared/model';
import { nextDate } from '../../shared/next-actions';
import { StatusBar } from './status-bar';

interface Tile {
  id: string;
  label: string;
  range: string;
  actions: Action[];
  now?: boolean;
  ny?: boolean;
}

/** One tile per action-plan group, each an in-page link to it. */
export function QuarterTiles({
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
  const tiles: Tile[] = quarterColumns(plan).map((q) => ({
    id: q.quarter.toLowerCase(),
    label: q.quarter,
    range: q.range,
    actions: target.actions.filter((a) => a.quarter === q.quarter),
    now: q.quarter === currentQuarter,
  }));
  const ongoing = target.actions.filter((a) => a.quarter === 'ongoing');
  if (ongoing.length)
    tiles.push({ id: 'ongoing', label: 'All year', range: 'Ongoing · repeats', actions: ongoing });
  const ny = target.actions.filter(isNextYear);
  if (ny.length)
    tiles.push({
      id: 'next_year',
      label: 'Next year',
      range: 'Not in this year',
      actions: ny,
      ny: true,
    });
  const late = (a: Action) =>
    a.status !== 'done' && !isNextYear(a) && compareYmd(nextDate(plan, a, today), today) < 0;

  return (
    <nav className="qtiles" aria-label="Quarters">
      {tiles.map((t) => {
        const done = t.actions.filter((a) => a.status === 'done').length;
        const overdue = t.actions.filter(late).length;
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={`card qtile${t.now ? ' now' : ''}${t.ny ? ' ny' : ''}`}
          >
            <span className="lbl">
              {t.label}
              {t.now && <span className="now-pill">NOW</span>}
            </span>
            <small>{t.range}</small>
            <StatusBar actions={t.actions} />
            <span className="sum">
              {done} of {t.actions.length} done
              {overdue ? ` · ${overdue} overdue` : ''}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
