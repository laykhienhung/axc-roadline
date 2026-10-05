import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext } from '../../shared/auth';
import { ApiError, signIn } from '../api';
import { AuthCard } from '../components/auth-card';
import { Field } from '../components/field';

export function SignInPage({ setMe }: { setMe: (me: Awaited<ReturnType<typeof signIn>>) => void }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<'invalid' | 'disabled' | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await signIn({ email, password });
      // Navigate before setMe so PublicRoute's own redirect doesn't race this one.
      navigate(me.mustChangePassword ? `/update-password?next=${encodeURIComponent(next)}` : next, {
        replace: true,
      });
      setMe(me);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.body.error === 'account_disabled' ? 'disabled' : 'invalid');
        if (cause.body.error === 'invalid_credentials') setPassword('');
      }
    } finally {
      setBusy(false);
    }
  }

  const signedOut = params.get('signedout') === '1';
  const notice =
    error === 'invalid' ? (
      <div className="notice tone-behind" role="alert">
        <b>Email or password is wrong</b>
        <span>Check both and try again. Forgot your password? Ask an admin to reset it.</span>
      </div>
    ) : error === 'disabled' ? (
      <div className="notice tone-at_risk" role="alert">
        <b>Your access is turned off</b>
        <span>An admin has disabled this account. Ask an admin to enable it.</span>
      </div>
    ) : params.get('expired') === '1' ? (
      <div className="notice tone-at_risk" role="status">
        <b>Your session ended</b>
        <span>Sign in again to continue where you were.</span>
      </div>
    ) : undefined;
  return (
    <AuthCard
      title={signedOut ? "You're signed out" : 'Sign in'}
      intro={signedOut ? 'Sign in again to view the plan.' : 'AXC objectives & action plan.'}
      notice={notice}
      foot={
        <>
          <span>No account yet?</span>
          <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account →</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          required
        />
        <button className="btn primary" disabled={busy}>
          {busy && <i className="spin" />} {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}
