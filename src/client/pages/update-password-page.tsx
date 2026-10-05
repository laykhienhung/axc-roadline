import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, validateNewPassword, type FieldErrors, type Me } from '../../shared/auth';
import { ApiError, changePassword } from '../api';
import { AuthCard } from '../components/auth-card';
import { Field } from '../components/field';

export function UpdatePasswordPage({
  me,
  setMe,
}: {
  me: Me;
  setMe: (me: Me, toast?: string) => void;
}) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const forced = me.mustChangePassword;
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateNewPassword({ password, repeat, current: forced ? undefined : current });
    setFields(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const updated = await changePassword({ ...(forced ? {} : { current }), password, repeat });
      // Forced: continue to `next`; voluntary: back to where the user came from (like Cancel).
      navigate(forced ? next : (location.state?.from ?? '/'), { replace: true });
      setMe(
        updated,
        '✓ Password updated. You’re still signed in here; other devices were signed out.'
      );
    } catch (cause) {
      if (cause instanceof ApiError) setFields(cause.body.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit}>
      {!forced && (
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={fields.current}
          disabled={busy}
        />
      )}
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fields.password}
        disabled={busy}
      />
      <Field
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        error={fields.repeat}
        disabled={busy}
      />
      <button className="btn primary" disabled={busy}>
        {busy ? 'Saving…' : forced ? 'Save and continue' : 'Save'}
      </button>
    </form>
  );
  if (forced)
    return (
      <AuthCard
        title="Set a new password"
        intro={
          <>
            An admin reset your password. Choose a new one to continue, {me.name.split(/\s+/)[0]}.
          </>
        }
        notice={
          <div className="notice tone-at_risk" role="status">
            <b>Required before you can open the plan</b>
            <span>Signed in as {me.email}</span>
          </div>
        }
        foot={
          <>
            <span>Not you?</span>
            <form method="post" action="/auth/signout">
              <button type="submit" className="link-btn">
                Sign out
              </button>
            </form>
          </>
        }
      >
        {form}
      </AuthCard>
    );
  return (
    <>
      <header className="app-header">
        <Link className="brand" to="/">
          <span className="wordmark">Roadline</span>
        </Link>
        <div className="divider" />
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Timeline</Link>
          <span className="sep">/</span>
          <span className="here">Change password</span>
        </nav>
      </header>
      <main className="auth voluntary">
        <section className="card auth-card">
          <h2>Change password</h2>
          <p className="intro">For {me.email}</p>
          {form}
          <div className="foot">
            <Link to={location.state?.from ?? '/'}>Cancel</Link>
          </div>
        </section>
      </main>
    </>
  );
}
