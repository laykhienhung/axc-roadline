import { useCallback, useEffect, useState } from 'react';
import type { Plan } from '../shared/model';
import { fetchPlan } from './api';

export type PlanState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; plan: Plan }
  | { status: 'error'; message: string };

/** The shared plan from the server, plus `replace` after a successful import. */
export function usePlan() {
  const [state, setState] = useState<PlanState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    fetchPlan()
      .then((plan) => live && setState(plan ? { status: 'ready', plan } : { status: 'empty' }))
      .catch((e: Error) => live && setState({ status: 'error', message: e.message }));
    return () => {
      live = false;
    };
  }, []);
  const replace = useCallback((plan: Plan) => setState({ status: 'ready', plan }), []);
  return { state, replace };
}
