import { Link, useParams } from 'react-router-dom';
import { currentPeriod } from '../../shared/fiscal';
import type { Me } from '../../shared/auth';
import { nounFor } from '../../shared/noun';
import { ActionPlan } from '../components/action-plan';
import { Brand } from '../components/app-header';
import { ObjectiveDetails } from '../components/objective-details';
import { QuarterTiles } from '../components/quarter-tiles';
import { TargetHeader } from '../components/target-header';
import { TargetSections } from '../components/target-sections';
import { UserMenu } from '../components/user-menu';
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

export function TargetPage({ state, me }: { state: PlanState; me: Me }) {
  const { id } = useParams();
  const today = useToday();
  const suffix = useLinkSuffix();
  const plan = state.status === 'ready' ? state.plan : null;
  const target = plan?.targets.find((t) => t.id === id);
  const noun = nounFor(plan);
  const currentQuarter = plan ? (currentPeriod(plan, today)?.quarter ?? null) : null;
  // 4.2 files have none of the 2.x note blocks: drop the empty side column there (as in the
  // approved mockup). A 2.x target always keeps it.
  const showNotes =
    !target ||
    plan?.layout !== 'objectives' ||
    [target.mustAchieve, target.dependsOn, target.risks, target.how, target.changes].some(
      (list) => list.length > 0
    );

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
        {me.role === 'viewer' && (
          <span className="readonly">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="lbl">Read-only</span>
          </span>
        )}
        <UserMenu me={me} />
      </header>
      <main>
        {state.status === 'loading' && <p className="muted">Loading plan…</p>}
        {state.status !== 'loading' && (!plan || !target) && (
          <section className="card not-found">
            <b>{noun.One} not found</b>
            <br />“{id}” isn&apos;t in the current import.{' '}
            <Link to={`/${suffix}`}>Back to timeline</Link>
          </section>
        )}
        {plan && target && (
          <>
            <TargetHeader plan={plan} target={target} today={today} />
            <ObjectiveDetails target={target} />
            <QuarterTiles
              plan={plan}
              target={target}
              currentQuarter={currentQuarter}
              today={today}
            />
            <div className={`tp-body${showNotes ? '' : ' solo'}`}>
              <ActionPlan
                plan={plan}
                target={target}
                currentQuarter={currentQuarter}
                today={today}
              />
              {showNotes && <TargetSections plan={plan} target={target} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
