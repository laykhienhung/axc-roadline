import type { ReactNode } from 'react';
import type { Plan } from '../../shared/model';
import { fiscalRange, formatDateTime } from '../format';

/** Logo mark + wordmark, shared by both page headers. */
export function Brand() {
  return (
    <div className="brand">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" fill="#1f2a4a" />
        <path
          d="M6 14h16"
          stroke="#7dff9b"
          strokeWidth="2"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <rect x="18" y="11" width="6" height="6" fill="#ffcc4d" />
      </svg>
      <span className="wordmark">Roadline</span>
    </div>
  );
}

/** "Sep 2026 – Aug 2027 · from plan.xlsx · updated 28 Sep 2026 14:02" */
export const planMeta = (plan: Plan) =>
  `${fiscalRange(plan)} · from ${plan.source.fileName} · updated ${formatDateTime(plan.source.importedAt)}`;

export function AppHeader({ plan, actions }: { plan: Plan | null; actions: ReactNode }) {
  return (
    <header className="app-header">
      <Brand />
      <div className="divider" />
      <div className="plan-meta">
        <h1>{plan ? plan.title : 'AXC Action Plan'}</h1>
        {plan && <small>{planMeta(plan)}</small>}
      </div>
      <div className="spacer" />
      {actions}
    </header>
  );
}
