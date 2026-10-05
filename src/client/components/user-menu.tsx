import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { initials, type Me, type Role } from '../../shared/auth';

const roleCopy: Record<Role, string> = {
  viewer: 'Viewer — you can view the plan. Ask an editor to import a new workbook.',
  editor: 'Editor — you can import and replace the plan for everyone.',
  admin: 'Admin — you can import the plan and manage who has access.',
};

const roleTone: Record<Role, string> = {
  viewer: 'tone-not_started',
  editor: 'tone-on_track',
  admin: 'tone-done',
};

function roleName(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Account chip with session actions for every signed-in page header. */
export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const name = roleName(me.role);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="user" ref={root}>
      <button
        type="button"
        className="user-chip"
        aria-label={`Account: ${me.name} (${name})`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initials(me.name)}</span>
        <span className="name">{me.name}</span>
        <span className={`badge ${roleTone[me.role]}`}>{name}</span>
        <span className="caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="card menu" role="menu">
          <div className="who">
            <span className="avatar">{initials(me.name)}</span>
            <div>
              <b>{me.name}</b>
              <small>{me.email}</small>
            </div>
          </div>
          <p className="role">{roleCopy[me.role]}</p>
          {me.role === 'admin' && (
            <Link className="btn" to="/admin">
              Admin · users &amp; import log
            </Link>
          )}
          <Link
            className="btn"
            to="/update-password"
            state={{ from: `${location.pathname}${location.search}` }}
          >
            Change password
          </Link>
          <form method="post" action="/auth/signout">
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
