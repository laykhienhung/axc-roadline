import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { safeNext, type Me } from '../shared/auth';
import { AdminPage } from './pages/admin-page';
import { SignInPage } from './pages/signin-page';
import { SignUpPage } from './pages/signup-page';
import { TargetPage } from './pages/target-page';
import { TimelinePage } from './pages/timeline-page';
import { UpdatePasswordPage } from './pages/update-password-page';
import { usePlan } from './use-plan';
import { useSession } from './use-session';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function nextFor(location: ReturnType<typeof useLocation>): string {
  return `${location.pathname}${location.search}`;
}

function SignedIn({
  me,
  toast,
  clearToast,
}: {
  me: Me;
  toast: string | null;
  clearToast: () => void;
}) {
  const location = useLocation();
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(clearToast, 5000);
    return () => window.clearTimeout(timeout);
  }, [toast, clearToast]);
  if (me.mustChangePassword) {
    return (
      <Navigate to={`/update-password?next=${encodeURIComponent(nextFor(location))}`} replace />
    );
  }
  return (
    <>
      {toast && (
        <p className="toast tone-on_track" role="status">
          {toast}
        </p>
      )}
      <Routes>
        <Route path="/admin" element={<AdminPage me={me} tab="users" />} />
        <Route path="/admin/imports" element={<AdminPage me={me} tab="imports" />} />
        <Route path="*" element={<PlanRoutes me={me} />} />
      </Routes>
    </>
  );
}

function PlanRoutes({ me }: { me: Me }) {
  const { state, replace } = usePlan();
  return (
    <>
      <Routes>
        <Route path="/" element={<TimelinePage state={state} replace={replace} me={me} />} />
        <Route path="/target/:id" element={<TargetPage state={state} me={me} />} />
        <Route path="*" element={<TimelinePage state={state} replace={replace} me={me} />} />
      </Routes>
    </>
  );
}

function PublicRoute({ children, me }: { children: ReactNode; me: Me | null | undefined }) {
  const location = useLocation();
  if (me === undefined) return <p className="muted">Loading…</p>;
  if (me)
    return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />;
  return children;
}

export function App() {
  const session = useSession();
  const location = useLocation();
  const next = nextFor(location);
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/signin"
          element={
            <PublicRoute
              me={
                session.state.status === 'loading'
                  ? undefined
                  : session.state.status === 'signedIn'
                    ? session.state.me
                    : null
              }
            >
              <SignInPage setMe={session.setMe} />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute
              me={
                session.state.status === 'loading'
                  ? undefined
                  : session.state.status === 'signedIn'
                    ? session.state.me
                    : null
              }
            >
              <SignUpPage setMe={session.setMe} />
            </PublicRoute>
          }
        />
        <Route
          path="/update-password"
          element={
            session.state.status === 'loading' ? (
              <p className="muted">Loading…</p>
            ) : session.state.status === 'signedIn' ? (
              <UpdatePasswordPage me={session.state.me} setMe={session.setMe} />
            ) : (
              <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
            )
          }
        />
        <Route
          path="*"
          element={
            session.state.status === 'loading' ? (
              <p className="muted">Loading…</p>
            ) : session.state.status === 'signedOut' ? (
              <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
            ) : (
              <SignedIn
                me={session.state.me}
                toast={session.toast}
                clearToast={session.clearToast}
              />
            )
          }
        />
      </Routes>
    </>
  );
}
