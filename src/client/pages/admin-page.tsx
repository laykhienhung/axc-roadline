import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUser, Me } from '../../shared/auth';
import { fetchUsers } from '../api';
import { Brand } from '../components/app-header';
import { ImportLog, Skeleton } from '../components/import-log';
import { UserMenu } from '../components/user-menu';
import { UsersTable } from '../components/users-table';

type Users = { status: 'loading' } | { status: 'error' } | { status: 'ready'; users: AdminUser[] };

/** /admin (Users) and /admin/imports (Import log), admins only. */
export function AdminPage({ me, tab }: { me: Me; tab: 'users' | 'imports' }) {
  const isAdmin = me.role === 'admin';
  const [users, setUsers] = useState<Users>({ status: 'loading' });

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    fetchUsers()
      .then((list) => live && setUsers({ status: 'ready', users: list }))
      .catch(() => live && setUsers({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [isAdmin]);

  const onUser = useCallback(
    (updated: AdminUser) =>
      setUsers((s) =>
        s.status === 'ready'
          ? { ...s, users: s.users.map((u) => (u.id === updated.id ? updated : u)) }
          : s
      ),
    []
  );

  return (
    <div className="admin">
      <header className="app-header">
        <Brand />
        <div className="divider" />
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Timeline</Link>
          <span className="sep">/</span>
          <span className="here">Admin</span>
        </nav>
        <div className="spacer" />
        <UserMenu me={me} />
      </header>
      <main>
        {!isAdmin ? (
          <section className="card admin-empty" aria-label="Admins only">
            <b>Admins only</b>
            <p className="muted small">
              You’re signed in as {me.role === 'editor' ? 'an Editor' : 'a Viewer'}. Ask an admin if
              you need access.
            </p>
            <Link className="btn" to="/">
              Back to timeline
            </Link>
          </section>
        ) : (
          <>
            <div className="page-title">
              <div>
                <h2>Admin</h2>
                <p>Who can open Roadline and who can import the plan.</p>
              </div>
            </div>
            <nav className="tabs" aria-label="Admin sections">
              <Link
                to="/admin"
                className={tab === 'users' ? 'on' : undefined}
                aria-current={tab === 'users' ? 'page' : undefined}
              >
                Users{' '}
                {users.status === 'ready' && <span className="muted">{users.users.length}</span>}
              </Link>
              <Link
                to="/admin/imports"
                className={tab === 'imports' ? 'on' : undefined}
                aria-current={tab === 'imports' ? 'page' : undefined}
              >
                Import log
              </Link>
            </nav>
            {tab === 'imports' ? (
              <ImportLog />
            ) : users.status === 'loading' ? (
              <Skeleton label="Loading users…" />
            ) : users.status === 'error' ? (
              <section className="card admin-empty" aria-label="Users">
                <b>Couldn’t load users</b>
                <p className="muted small">Reload the page to try again.</p>
              </section>
            ) : (
              <UsersTable me={me} users={users.users} onUser={onUser} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
