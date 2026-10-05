import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext, validateSignup, type FieldErrors } from '../../shared/auth';
import { ApiError, signUp } from '../api';
import { AuthCard } from '../components/auth-card';
import { Field } from '../components/field';

export function SignUpPage({
  setMe,
}: {
  setMe: (me: Awaited<ReturnType<typeof signUp>>, toast?: string) => void;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', repeat: '' });
  const [fields, setFields] = useState<FieldErrors>({});
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateSignup(values);
    setFields(local);
    setTaken(false);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const me = await signUp(values);
      navigate(next, { replace: true });
      setMe(
        me,
        me.role === 'admin'
          ? `✓ Welcome, ${me.name}. You're signed in as an Admin.`
          : `✓ Welcome, ${me.name}. You're signed in as a Viewer — ask an admin if you need to import the plan.`
      );
    } catch (cause) {
      if (cause instanceof ApiError) {
        setTaken(cause.body.error === 'email_taken');
        setFields(cause.body.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      title="Create an account"
      intro={
        <>
          You&apos;ll start as a <span className="badge tone-not_started">Viewer</span> — an admin
          can give you more access.
        </>
      }
      notice={
        taken ? (
          <div className="notice tone-behind" role="alert">
            <b>This email already has an account</b>
            <span>Sign in instead. Forgot the password? Ask an admin to reset it.</span>
          </div>
        ) : undefined
      }
      foot={
        <>
          <span>Already have an account?</span>
          <Link to={`/signin?next=${encodeURIComponent(next)}`}>Sign in →</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field
          label="Name"
          value={values.name}
          onChange={set('name')}
          error={fields.name}
          disabled={busy}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={values.email}
          onChange={set('email')}
          error={fields.email}
          disabled={busy}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          value={values.password}
          onChange={set('password')}
          error={fields.password}
          disabled={busy}
        />
        <Field
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          value={values.repeat}
          onChange={set('repeat')}
          error={fields.repeat}
          disabled={busy}
        />
        <button className="btn primary" disabled={busy}>
          {busy && <i className="spin" />} {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
