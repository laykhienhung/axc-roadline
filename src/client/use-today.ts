import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { parseYmd, ymdFromDate } from '../shared/fiscal';
import type { Ymd } from '../shared/model';

/** Local today, overridable with `?today=YYYY-MM-DD` (tests and demos). */
export function useToday(): Ymd {
  const { search } = useLocation();
  return useMemo(() => {
    const override = new URLSearchParams(search).get('today');
    return (override && parseYmd(override)) || ymdFromDate(new Date());
  }, [search]);
}

/** Keep `?today=` on internal links so a demo date survives navigation. */
export function useLinkSuffix(): string {
  const { search } = useLocation();
  const today = new URLSearchParams(search).get('today');
  return today ? `?today=${encodeURIComponent(today)}` : '';
}
