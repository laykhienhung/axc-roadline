import { useEffect, useState } from 'react';
import { initials, type AdminUser, type Me, type Role } from '../../shared/auth';
import { ApiError, patchUser, resetPassword, signOutAll } from '../api';
import { formatDateTime } from '../format';
import { ConfirmDialog } from './confirm-dialog';

type Filter = 'all' | Role | 'disabled';
type Toast = { tone: 'ok' | 'bad'; text: string } | null;
type Pending =
  | { kind: 'disable'; user: AdminUser }
  | { kind: 'signout'; user: AdminUser }
  | { kind: 'reset'; user: AdminUser }
  | null;

const ROLES: Role[] = ['viewer', 'editor', 'admin'];
const ROLE_TONE: Record<Role, string> = {
  viewer: 'tone-not_started',
  editor: 'tone-on_track',
  admin: 'tone-done',
};
const roleName = (role: Role) => role[0].toUpperCase() + role.slice(1);
const withArticle = (role: Role) => `${role === 'viewer' ? 'a' : 'an'} ${roleName(role)}`;

function failure(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) return 'the database isn’t reachable';
  if (error instanceof ApiError && error.body.error) return error.body.error.replaceAll('_', ' ');
  return 'the server didn’t answer';
}

function matches(user: AdminUser, filter: Filter, query: string): boolean {
  if (
    filter === 'disabled'
      ? !user.disabled
      : filter !== 'all' && (user.disabled || user.role !== filter)
  )
    return false;
  const q = query.trim().toLowerCase();
  return !q || user.name.toLowerCase().includes(q) || user.email.includes(q);
}

/** Admin › Users: role, reset password, sign out everywhere, disable/enable. */
export function UsersTable({
  me,
  users,
  onUser,
}: {
  me: Me;
  users: AdminUser[];
  onUser: (user: AdminUser) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const count = (f: Filter) => users.filter((u) => matches(u, f, '')).length;
  const shown = users.filter((u) => matches(u, filter, query));

  async function run(user: AdminUser, action: () => Promise<string>) {
    setSaving(user.id);
    try {
      setToast({ tone: 'ok', text: await action() });
    } catch (error) {
      setToast({
        tone: 'bad',
        text: `Couldn’t save the change — ${failure(error)}. Nothing changed.`,
      });
    } finally {
      setSaving(null);
      setPending(null);
    }
  }

  const changeRole = (user: AdminUser, role: Role) =>
    run(user, async () => {
      onUser(await patchUser(user.id, { role }));
      return `✓ ${user.name} is now ${withArticle(role)}. It applies on their next page load.`;
    });

  function confirmPending() {
    if (!pending) return;
    const { user } = pending;
    if (pending.kind === 'disable')
      void run(user, async () => {
        onUser(await patchUser(user.id, { disabled: true }));
        return `✓ ${user.name} is disabled and signed out everywhere.`;
      });
    if (pending.kind === 'signout')
      void run(user, async () => {
        const { revoked } = await signOutAll(user.id);
        return `✓ ${user.name} is signed out everywhere (${revoked} ${revoked === 1 ? 'session' : 'sessions'}).`;
      });
    if (pending.kind === 'reset')
      void run(user, async () => {
        onUser(await resetPassword(user.id));
        return `✓ ${user.name}’s password is now 1111. Tell them — they’ll set a new one at next sign-in.`;
      });
  }

  const FILTERS: [Filter, string][] = [
    ['all', 'All'],
    ['admin', 'Admins'],
    ['editor', 'Editors'],
    ['viewer', 'Viewers'],
    ['disabled', 'Disabled'],
  ];

  return (
    <>
      {toast && (
        <p
          className={`toast ${toast.tone === 'ok' ? 'tone-on_track' : 'tone-behind'}`}
          role={toast.tone === 'ok' ? 'status' : 'alert'}
        >
          {toast.text}
        </p>
      )}
      <section className="card" aria-label="Users">
        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search name or email…"
            aria-label="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="seg" role="group" aria-label="Filter by role">
            {FILTERS.map(([f, label]) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'on' : undefined}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {label} {count(f)}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <span className="small muted">People appear here once they create an account.</span>
        </div>
        <table className="users">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Last sign-in</th>
              <th>Signed up</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => {
              const self = user.id === me.id;
              const busy = saving === user.id;
              return (
                <tr
                  key={user.id}
                  className={user.disabled ? 'off' : undefined}
                  data-user={user.email}
                >
                  <td>
                    <div className="who">
                      <span className="avatar">{initials(user.name)}</span>
                      <div>
                        <b>{user.name}</b>
                        <small>{user.email}</small>
                      </div>
                      {user.mustChangePassword && !user.disabled && (
                        <span className="badge tone-at_risk">Must update password</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {user.disabled ? (
                      <>
                        <span className="badge tone-behind">Disabled</span>{' '}
                        <span className="small muted">was {roleName(user.role)}</span>
                      </>
                    ) : user.locked || self ? (
                      <>
                        <span className={`badge ${ROLE_TONE[user.role]}`}>
                          {roleName(user.role)}
                        </span>
                        {user.locked && (
                          <span className="lock" title="Set by ADMIN_EMAILS on the server">
                            {' '}
                            🔒 from server settings
                          </span>
                        )}
                      </>
                    ) : (
                      <select
                        className="role-sel"
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={busy}
                        onChange={(e) => void changeRole(user, e.target.value as Role)}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleName(role)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="when">
                    {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : '—'}
                  </td>
                  <td className="when">{formatDateTime(user.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      {self ? (
                        <span className="small muted">You</span>
                      ) : user.locked ? null : user.disabled ? (
                        <button
                          type="button"
                          className="btn sm"
                          disabled={busy}
                          onClick={() =>
                            void run(user, async () => {
                              onUser(await patchUser(user.id, { disabled: false }));
                              return `✓ ${user.name} can sign in again as ${withArticle(user.role)}.`;
                            })
                          }
                        >
                          Enable
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn sm"
                            disabled={busy}
                            onClick={() => setPending({ kind: 'reset', user })}
                          >
                            Reset password
                          </button>
                          <button
                            type="button"
                            className="btn sm"
                            disabled={busy}
                            onClick={() => setPending({ kind: 'signout', user })}
                          >
                            Sign out everywhere
                          </button>
                          <button
                            type="button"
                            className="btn sm"
                            disabled={busy}
                            onClick={() => setPending({ kind: 'disable', user })}
                          >
                            Disable
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="admin-none muted small">No users match.</p>}
      </section>
      {pending && (
        <ConfirmDialog
          busy={saving !== null}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
          {...(pending.kind === 'disable'
            ? {
                title: `Disable ${pending.user.name}?`,
                body: `${pending.user.email} is signed out on every device and can’t sign in again until enabled. Nothing is deleted.`,
                confirmLabel: 'Disable',
              }
            : pending.kind === 'signout'
              ? {
                  title: `Sign out ${pending.user.name} everywhere?`,
                  body: `Every session of ${pending.user.email} ends now. They can sign in again.`,
                  confirmLabel: 'Sign out',
                }
              : {
                  title: `Reset ${pending.user.name}’s password?`,
                  body: `The password becomes 1111. ${pending.user.email} is signed out everywhere now and must choose a new password at next sign-in.`,
                  confirmLabel: 'Reset to 1111',
                })}
        />
      )}
    </>
  );
}
