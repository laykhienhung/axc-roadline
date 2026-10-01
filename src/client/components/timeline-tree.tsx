import { useEffect, useRef, useState } from 'react';
import {
  compareYmd,
  currentPeriod,
  hasNextYear,
  isNextYear,
  nextFiscalLabel,
  QUARTERS,
  quarterColumns,
} from '../../shared/fiscal';
import type { Action, Plan, QuarterMeaning, Status, Target, Ymd } from '../../shared/model';
import { nextDate } from '../../shared/next-actions';
import { planSummary } from '../../shared/summary';
import { STATUS_LABEL } from '../../shared/status';
import { dueLong } from '../format';

export type Orientation = 'horizontal' | 'vertical';

/** Which action the drawer shows. */
export interface ActionRef {
  targetId: string;
  no: number;
}

export const actionKey = (r: ActionRef) => `${r.targetId}-${r.no}`;

export const isOverdue = (plan: Plan, a: Action, today: Ymd) =>
  a.status !== 'done' && !isNextYear(a) && compareYmd(nextDate(plan, a, today), today) < 0;

interface Station {
  key: QuarterMeaning;
  label: string;
  range: string;
  now: boolean;
  items: { target: Target; action: Action }[];
}

/** Q1–Q4, Ongoing, and Next year when the plan has any. */
export function stations(plan: Plan, today: Ymd): Station[] {
  const current = currentPeriod(plan, today)?.quarter;
  const items = (key: QuarterMeaning) =>
    plan.targets.flatMap((target) =>
      target.actions.filter((a) => a.quarter === key).map((action) => ({ target, action }))
    );
  const out: Station[] = quarterColumns(plan).map((q) => ({
    key: q.quarter,
    label: q.label,
    range: q.range,
    now: q.quarter === current,
    items: items(q.quarter),
  }));
  out.push({
    key: 'ongoing',
    label: 'Ongoing',
    range: 'repeats all year',
    now: false,
    items: items('ongoing'),
  });
  if (hasNextYear(plan))
    out.push({
      key: 'next_year',
      label: 'Next year',
      range: nextFiscalLabel(plan),
      now: false,
      items: items('next_year'),
    });
  return out;
}

/** What the squares mean. Overdue actions are drawn in the Behind color. */
const LEGEND: [Status, string][] = [
  ['done', STATUS_LABEL.done],
  ['on_track', STATUS_LABEL.on_track],
  ['at_risk', STATUS_LABEL.at_risk],
  ['behind', `${STATUS_LABEL.behind} or overdue`],
  ['not_started', STATUS_LABEL.not_started],
];

const uniq = <T,>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);

interface TreeProps {
  plan: Plan;
  today: Ymd;
  station: Station;
  folders: Set<string>;
  toggle: (key: string) => void;
  selected: ActionRef | null;
  onSelect: (ref: ActionRef) => void;
}

/** quarter → target → section → action, drawn with box-drawing lines. */
function StationTree({ plan, today, station, folders, toggle, selected, onSelect }: TreeProps) {
  const targets = uniq(station.items.map((i) => i.target));
  if (!targets.length) return <p className="tt-empty">Nothing planned.</p>;
  const count = (actions: Action[]) =>
    `${actions.filter((a) => a.status === 'done').length}/${actions.length}`;
  return (
    <ul className="tt-tree" aria-label={`${station.label} actions`}>
      {targets.map((t, ti) => {
        const lastT = ti === targets.length - 1;
        const tActions = station.items.filter((i) => i.target === t).map((i) => i.action);
        const tKey = `${station.key}/${t.id}`;
        const tOpen = folders.has(tKey);
        const sections = uniq(tActions.map((a) => a.section));
        return (
          <li key={t.id}>
            <button
              type="button"
              className="tt-row folder"
              aria-expanded={tOpen}
              onClick={() => toggle(tKey)}
            >
              <span className="pre">{lastT ? '└─' : '├─'}</span>
              <span className="glyph">{tOpen ? '[-]' : '[+]'}</span>
              <span className="lbl">
                {t.id} {t.name}
              </span>
              <span className="side">{count(tActions)}</span>
            </button>
            {tOpen && (
              <ul>
                {sections.map((s, si) => {
                  const lastS = si === sections.length - 1;
                  const sActions = tActions.filter((a) => a.section === s);
                  const sKey = `${tKey}/${s}`;
                  const sOpen = folders.has(sKey);
                  const p1 = lastT ? '   ' : '│  ';
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        className="tt-row folder sub"
                        aria-expanded={sOpen}
                        onClick={() => toggle(sKey)}
                      >
                        <span className="pre">{p1 + (lastS ? '└─' : '├─')}</span>
                        <span className="glyph">{sOpen ? '[-]' : '[+]'}</span>
                        <span className="lbl">{s || 'Actions'}</span>
                        <span className="side">{count(sActions)}</span>
                      </button>
                      {sOpen && (
                        <ul>
                          {sActions.map((a, ai) => {
                            const late = isOverdue(plan, a, today);
                            const on = selected?.targetId === t.id && selected.no === a.no;
                            return (
                              <li key={a.no}>
                                <button
                                  type="button"
                                  className={`tt-row leaf${on ? ' on' : ''}`}
                                  aria-pressed={on}
                                  data-action={actionKey({ targetId: t.id, no: a.no })}
                                  onClick={() => onSelect({ targetId: t.id, no: a.no })}
                                >
                                  <span className="pre">
                                    {p1 +
                                      (lastS ? '   ' : '│  ') +
                                      (ai === sActions.length - 1 ? '└─' : '├─')}
                                  </span>
                                  <span
                                    className={`sq bg-${late ? 'behind' : a.status}`}
                                    title={
                                      late ? 'Overdue' : a.statusWord || STATUS_LABEL[a.status]
                                    }
                                  />
                                  <span className="lbl">
                                    #{a.no} {a.action}
                                  </span>
                                  <span className={`side${late ? ' late' : ''}`}>{dueLong(a)}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StationHead({ plan, today, station }: { plan: Plan; today: Ymd; station: Station }) {
  const actions = station.items.map((i) => i.action);
  const late = actions.filter((a) => isOverdue(plan, a, today)).length;
  return (
    <>
      <span className="st-name">
        {station.label}
        {station.now && <span className="now-pill">NOW</span>}
      </span>
      <span className="st-range">{station.range}</span>
      <span className="pips" aria-hidden="true">
        {actions.map((a, i) => (
          <span key={i} className={`bg-${isOverdue(plan, a, today) ? 'behind' : a.status}`} />
        ))}
      </span>
      <span className="st-stat">
        {actions.filter((a) => a.status === 'done').length}/{actions.length} done
        {late > 0 && <b className="late"> · {late} late</b>}
      </span>
    </>
  );
}

export function TimelineTree({
  plan,
  today,
  selected,
  onSelect,
}: {
  plan: Plan;
  today: Ymd;
  selected: ActionRef | null;
  onSelect: (ref: ActionRef) => void;
}) {
  const all = stations(plan, today);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [open, setOpen] = useState<Set<QuarterMeaning>>(
    () => new Set([all.find((s) => s.now)?.key ?? QUARTERS[0]])
  );
  const [folders, setFolders] = useState<Set<string>>(new Set());
  const flip = <T,>(set: Set<T>, key: T) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };
  const toggleFolder = (key: string) => setFolders((f) => flip(f, key));
  const toggleStation = (key: QuarterMeaning) => setOpen((o) => flip(o, key));

  // Picking an action (e.g. from the drawer) opens its quarter and folders so the row shows.
  const selTarget = selected?.targetId;
  const selNo = selected?.no;
  useEffect(() => {
    const a = plan.targets.find((t) => t.id === selTarget)?.actions.find((x) => x.no === selNo);
    if (!a) return;
    const tKey = `${a.quarter}/${a.targetId}`;
    setOpen((o) => (o.has(a.quarter) ? o : new Set(o).add(a.quarter)));
    setFolders((f) =>
      f.has(tKey) && f.has(`${tKey}/${a.section}`)
        ? f
        : new Set(f).add(tKey).add(`${tKey}/${a.section}`)
    );
  }, [plan, selTarget, selNo]);
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    scrollTo.current = selTarget ? `${selTarget}-${selNo}` : null;
  }, [selTarget, selNo]);
  // Runs after the folders above have rendered; scrolls once per new selection.
  useEffect(() => {
    if (!scrollTo.current) return;
    const row = document.querySelector(`[data-action="${scrollTo.current}"]`);
    if (!row) return;
    row.scrollIntoView?.({ block: 'nearest' });
    scrollTo.current = null;
  });

  const s = planSummary(plan, today);
  const pct = Math.round(s.yearProgress * 100);
  const blocks = 30;
  const filled = Math.round((pct / 100) * blocks);
  const tree = (st: Station) => (
    <StationTree
      plan={plan}
      today={today}
      station={st}
      folders={folders}
      toggle={toggleFolder}
      selected={selected}
      onSelect={onSelect}
    />
  );

  return (
    <section className="tt" aria-label="Timeline">
      <div className="tt-h">
        <h2>Timeline</h2>
        <span className="xp" aria-label={`Year progress ${pct}%`}>
          <span className="blocks" aria-hidden="true">
            {Array.from({ length: blocks }, (_, i) => (
              <span key={i} className={i < filled ? 'on' : ''} />
            ))}
          </span>
          <b>{pct}%</b>
          <span className="muted">
            {s.done}/{s.total} done
          </span>
        </span>
        <span className={s.overdue ? 'late' : 'muted'}>{s.overdue} overdue</span>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="Orientation">
          {(['horizontal', 'vertical'] as const).map((o) => (
            <button
              key={o}
              type="button"
              className={orientation === o ? 'on' : ''}
              aria-pressed={orientation === o}
              onClick={() => setOrientation(o)}
            >
              {o === 'horizontal' ? '◀▶ Horizontal' : '▲▼ Vertical'}
            </button>
          ))}
        </div>
      </div>
      <ul className="legend tt-legend" aria-label="Status legend">
        {LEGEND.map(([tone, label]) => (
          <li key={tone}>
            <span className={`sq bg-${tone}`} aria-hidden="true" />
            {label}
          </li>
        ))}
        <li className="note">One square per action · [+] opens a folder</li>
      </ul>

      {orientation === 'horizontal' ? (
        <div className="tt-h-body">
          <div
            className="tt-rail"
            style={{ gridTemplateColumns: `repeat(${all.length}, minmax(0, 1fr))` }}
          >
            {all.map((st) => (
              <button
                key={st.key}
                type="button"
                className={`tt-stop${st.now ? ' now' : ''}${open.has(st.key) ? ' open' : ''}`}
                aria-expanded={open.has(st.key)}
                data-station={st.key}
                onClick={() => toggleStation(st.key)}
              >
                <StationHead plan={plan} today={today} station={st} />
              </button>
            ))}
          </div>
          {open.size > 0 && (
            <div
              className="tt-cols"
              style={{ gridTemplateColumns: `repeat(${open.size}, minmax(0, 1fr))` }}
            >
              {all
                .filter((st) => open.has(st.key))
                .map((st) => (
                  <div key={st.key} className={`tt-panel${st.now ? ' now' : ''}`}>
                    <div className="tt-panel-h">
                      <b>{st.label}/</b>
                      <span className="muted">{st.range}</span>
                    </div>
                    {tree(st)}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <ol className="tt-v-body">
          {all.map((st) => (
            <li key={st.key} className={`tt-vstop${st.now ? ' now' : ''}`}>
              <span className="mark" aria-hidden="true" />
              <div className="tt-vmain">
                <button
                  type="button"
                  className={`tt-stop row${open.has(st.key) ? ' open' : ''}`}
                  aria-expanded={open.has(st.key)}
                  data-station={st.key}
                  onClick={() => toggleStation(st.key)}
                >
                  <StationHead plan={plan} today={today} station={st} />
                </button>
                {open.has(st.key) && <div className="tt-panel">{tree(st)}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
