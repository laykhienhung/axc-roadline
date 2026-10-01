import { Link, useParams } from 'react-router-dom';
import { currentPeriod } from '../../shared/fiscal';
import { ActionPlan } from '../components/action-plan';
import { Brand } from '../components/app-header';
import { QuarterTiles } from '../components/quarter-tiles';
import { TargetHeader } from '../components/target-header';
import { TargetSections } from '../components/target-sections';
import { formatDateTime } from '../format';
import type { PlanState } from '../use-plan';
import { useLinkSuffix, useToday } from '../use-today';

const BackIcon = () => (
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
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export function TargetPage({ state }: { state: PlanState }) {
  const { id } = useParams();
  const today = useToday();
  const suffix = useLinkSuffix();
  const plan = state.status === 'ready' ? state.plan : null;
  const target = plan?.targets.find((t) => t.id === id);
  const currentQuarter = plan ? (currentPeriod(plan, today)?.quarter ?? null) : null;

  return (
    <div className="target">
      <header className="app-header">
        <Brand />
        <div className="divider" />
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to={`/${suffix}`}>
            <BackIcon />
            Timeline
          </Link>
          {target && (
            <>
              <span className="sep">/</span>
              <span className="here">
                {target.id} · {target.name}
              </span>
            </>
          )}
        </nav>
        <div className="spacer" />
        {plan && (
          <small>
            {plan.title} · updated {formatDateTime(plan.source.importedAt)}
          </small>
        )}
      </header>
      <main>
        {state.status === 'loading' && <p className="muted">Loading plan…</p>}
        {state.status !== 'loading' && (!plan || !target) && (
          <section className="card not-found">
            <b>Target not found</b>
            <br />“{id}” isn&apos;t in the current import.{' '}
            <Link to={`/${suffix}`}>Back to timeline</Link>
          </section>
        )}
        {plan && target && (
          <>
            <TargetHeader plan={plan} target={target} today={today} />
            <QuarterTiles
              plan={plan}
              target={target}
              currentQuarter={currentQuarter}
              today={today}
            />
            <div className="tp-body">
              <ActionPlan
                plan={plan}
                target={target}
                currentQuarter={currentQuarter}
                today={today}
              />
              <TargetSections target={target} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
