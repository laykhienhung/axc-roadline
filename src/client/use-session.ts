import { useCallback, useEffect, useState } from 'react';
import type { Me } from '../shared/auth';
import { fetchMe } from './api';

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; me: Me };

export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setState(me ? { status: 'signedIn', me } : { status: 'signedOut' });
    return me;
  }, []);

  useEffect(() => {
    void refresh().catch(() => setState({ status: 'signedOut' }));
  }, [refresh]);

  // A one-time message for the next signed-in page (welcome, password updated). It lives here,
  // not in router state, because PublicRoute's own redirect would drop that state.
  const [toast, setToast] = useState<string | null>(null);
  const setMe = useCallback((me: Me, message?: string) => {
    setState({ status: 'signedIn', me });
    if (message) setToast(message);
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  return { state, refresh, setMe, toast, clearToast };
}
