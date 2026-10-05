import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { quarterColumns } from '../../shared/fiscal';
import type { Action, Detail, Plan, Ymd } from '../../shared/model';
import { nextActions } from '../../shared/next-actions';
import { nounFor } from '../../shared/noun';
import { dueLong, percent } from '../format';
import { useLinkSuffix } from '../use-today';
import { Percent } from './percent';
import { StatusBadge } from './status-dot';
import { type ActionRef, isOverdue } from './timeline-tree';

/** How many upcoming actions of the target (objective) the drawer lists. */
const NEXT_LIMIT = 3;

const WIDTH_KEY = 'roadline.drawerWidth';
const DEFAULT_WIDTH = 540;
const MIN_WIDTH = 360;
const STEP = 24;

/** Keep room for the timeline: at most 900px, and at least 320px left of the drawer. */
const clampWidth = (w: number) =>
  Math.round(Math.max(MIN_WIDTH, Math.min(w, 900, window.innerWidth - 320)));

function savedWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return n ? clampWidth(n) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Drawer width, remembered per browser; also published as --drawer-w for the page padding. */
function useDrawerWidth() {
  const [width, setWidth] = useState(savedWidth);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--drawer-w', `${width}px`);
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // private mode or blocked storage: the width just isn't remembered
    }
    return () => {
      root.style.removeProperty('--drawer-w');
    };
  }, [width]);
  return [width, (w: number) => setWidth(clampWidth(w))] as const;
}

/** Drag, arrow keys or double-click (reset) on the drawer's left edge. */
function ResizeHandle({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    onResize(window.innerWidth - e.clientX);
  };
  const key = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onResize(width + STEP);
    else if (e.key === 'ArrowRight') onResize(width - STEP);
    else if (e.key === 'Home') onResize(DEFAULT_WIDTH);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className="drawer-grip"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize detail panel"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={drag}
      onDoubleClick={() => onResize(DEFAULT_WIDTH)}
      onKeyDown={key}
    >
      <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
        {[3, 9].map((x) =>
          [3, 8, 13, 18].map((y) => (
            <rect key={`${x}-${y}`} x={x - 1} y={y - 1} width="2" height="2" />
          ))
        )}
      </svg>
    </div>
  );
}

function quarterText(plan: Plan, a: Action): string {
  if (a.quarter === 'ongoing') return 'Ongoing · repeats all year';
  if (a.quarter === 'next_year') return 'Next year';
  const q = quarterColumns(plan).find((c) => c.quarter === a.quarter);
  return q ? `${q.label} · ${q.range}` : a.quarter;
}

/** "Goal / Needs first / JD" of the objective detail an action belongs to (4.2). */
function DetailSection({ detail }: { detail: Detail }) {
  return (
    <div className="drawer-sec">
      <h3>
        Objective detail {detail.id} · {detail.title}
      </h3>
      {detail.goal && <p className="goal">Goal: {detail.goal}</p>}
      {detail.needsFirst && <p className="needs">Needs first: {detail.needsFirst}</p>}
      {detail.jd && <p className="jd">JD: {detail.jd}</p>}
    </div>
  );
}

/** The detail of one action, sliding in from the right like a job-board detail pane. */
export function ActionDrawer({
  plan,
  today,
  selected,
  onSelect,
  onClose,
}: {
  plan: Plan;
  today: Ymd;
  selected: ActionRef;
  onSelect: (ref: ActionRef) => void;
  onClose: () => void;
}) {
  const suffix = useLinkSuffix();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useDrawerWidth();
  const target = plan.targets.find((t) => t.id === selected.targetId);
  const action = target?.actions.find((a) => a.no === selected.no);

  useEffect(() => {
    closeRef.current?.focus();
  }, [selected.targetId, selected.no]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!target || !action) return null;
  const late = isOverdue(plan, action, today);
  // Same ranking as the target page's "Next for this …": overdue first, then by due date.
  const next = nextActions(plan, today, { limit: NEXT_LIMIT, targetId: target.id });
  const noun = nounFor(plan);
  const detail = action.detailId
    ? target.details?.find((d) => d.id === action.detailId)
    : undefined;
  const byPercent = plan.progressBy === 'percent';
  const pct = action.percent ?? null;
  // A 4.2 deliverable repeats the action text; show it only when it says something more.
  const deliverable =
    plan.layout === 'objectives' && action.deliverable === action.action ? '' : action.deliverable;
  const refs = action.references ?? [];

  return (
    <aside className="drawer" role="dialog" aria-label="Action detail" style={{ width }}>
      <ResizeHandle width={width} onResize={setWidth} />
      <div className="drawer-scroll">
        <div className="drawer-bar">
          <span>
            &gt; {target.id}-{action.no}
          </span>
          <button
            ref={closeRef}
            type="button"
            className="drawer-x"
            aria-label="Close detail"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="drawer-b">
          <div className="drawer-head">
            <span className="idbox" aria-hidden="true">
              {target.id}
            </span>
            <div>
              <h2>{action.action}</h2>
              <Link to={`/target/${target.id}${suffix}`} className="tname">
                {target.id} · {target.name}
              </Link>
            </div>
          </div>
          <div className="tags">
            <StatusBadge status={action.status} word={action.statusWord} />
            {late && <span className="badge tone-behind">Overdue</span>}
          </div>
          <Link to={`/target/${target.id}${suffix}`} className="btn primary">
            ▶ Open {noun.one} {target.id}
          </Link>
          <dl className="drawer-facts">
            <dt>Quarter</dt>
            <dd>{quarterText(plan, action)}</dd>
            <dt>Due</dt>
            <dd className={late ? 'late' : ''}>{dueLong(action)}</dd>
            <dt>Owner</dt>
            <dd>{action.owner || '—'}</dd>
            {action.partners && (
              <>
                <dt>Partners</dt>
                <dd>{action.partners}</dd>
              </>
            )}
            {(byPercent || pct !== null) && (
              <>
                <dt>Progress</dt>
                <dd>
                  {pct === null ? (
                    <span className="muted">— (counts as 0%)</span>
                  ) : (
                    <Percent value={pct} width={80} />
                  )}
                </dd>
              </>
            )}
            {action.detailId ? (
              <>
                <dt>Detail</dt>
                <dd>{detail ? `${detail.id} · ${detail.title}` : action.detailId}</dd>
              </>
            ) : (
              <>
                <dt>Section</dt>
                <dd>{action.section || '—'}</dd>
              </>
            )}
            <dt>Weight</dt>
            <dd>
              {percent(target.weight)} of the year
              {target.weightSource === 'equal' && ' · equal'}
            </dd>
          </dl>
          {detail && <DetailSection detail={detail} />}
          {deliverable && (
            <div className="drawer-sec">
              <h3>Deliverable</h3>
              <span className="chip">{deliverable}</span>
            </div>
          )}
          {action.measure && (
            <div className="drawer-sec">
              <h3>Success measure</h3>
              <p>{action.measure}</p>
            </div>
          )}
          {refs.length > 0 && (
            <div className="drawer-sec">
              <h3>Reference documents</h3>
              <ul className="drawer-refs">
                {refs.map((r, i) => (
                  <li key={`${i}-${r}`}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {action.note && (
            <div className="drawer-sec">
              <h3>Note</h3>
              <p className="drawer-note">{action.note}</p>
            </div>
          )}
          {next.length > 0 && (
            <div className="drawer-sec">
              <h3>Next for {target.id}</h3>
              <ul className="drawer-next">
                {next.map(({ action: a, overdue }) => {
                  const on = a.no === action.no;
                  return (
                    <li key={a.no}>
                      <button
                        type="button"
                        className={on ? 'on' : undefined}
                        aria-current={on ? 'true' : undefined}
                        onClick={() => onSelect({ targetId: target.id, no: a.no })}
                      >
                        <span className={`sq bg-${overdue ? 'behind' : a.status}`} />
                        <span>
                          #{a.no} {a.action}
                          {on && <span className="viewing">◀ viewing</span>}
                        </span>
                        <span className={overdue ? 'late' : 'muted'}>{dueLong(a)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
