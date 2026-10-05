// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, ImportLogItem, Me } from '../src/shared/auth';
import { fixturePlan } from './helpers';
import { mockFetch, renderApp } from './render';

const ADMIN: Me = {
  id: 1,
  name: 'Hung Lay',
  email: 'hung.lay@example.com',
  role: 'admin',
  mustChangePassword: false,
};

const user = (over: Partial<AdminUser>): AdminUser => ({
  id: 0,
  email: 'x@example.com',
  name: 'X',
  role: 'viewer',
  disabled: false,
  locked: false,
  mustChangePassword: false,
  createdAt: '2026-10-01T02:00:00.000Z',
  lastSignInAt: null,
  ...over,
});

const USERS: AdminUser[] = [
  user({ id: 1, name: 'Hung Lay', email: 'hung.lay@example.com', role: 'admin', locked: true }),
  user({ id: 2, name: 'An Nguyen', email: 'an@example.com', role: 'editor' }),
  user({ id: 3, name: 'Minh Tran', email: 'minh@example.com', role: 'viewer' }),
  user({ id: 4, name: 'Lan Pham', email: 'lan@example.com', mustChangePassword: true }),
  user({ id: 5, name: 'Quang Vo', email: 'quang@example.com', disabled: true }),
];

const entry = (over: Partial<ImportLogItem>): ImportLogItem => ({
  id: 1,
  at: '2026-10-01T02:20:00.000Z',
  userEmail: 'an@example.com',
  fileName: 'plan.xlsx',
  fileSize: 217088,
  outcome: 'ok',
  planId: 12,
  current: true,
  detail: 'plan #12',
  ...over,
});

const ok = (body: unknown) => ({ status: 200, body });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const row = (email: string) => screen.getByText(email).closest('tr') as HTMLTableRowElement;

describe('admin page — users', () => {
  it('lists users with locked, own, reset and disabled rows', async () => {
    mockFetch(fixturePlan(), [], { me: ADMIN, routes: { '/api/admin/users': ok(USERS) } });
    renderApp('/admin');
    const card = await screen.findByLabelText('Users');
    expect(within(card).getAllByRole('row')).toHaveLength(USERS.length + 1);

    const own = row('hung.lay@example.com');
    expect(within(own).queryByRole('combobox')).toBeNull();
    expect(within(own).getByText('You')).toBeTruthy();
    expect(own.textContent).toContain('from server settings');

    expect(within(row('an@example.com')).getByLabelText('Role for An Nguyen')).toBeTruthy();
    expect(row('lan@example.com').textContent).toContain('Must update password');
    const off = row('quang@example.com');
    expect(off.textContent).toContain('Disabled');
    expect(within(off).getByRole('button', { name: 'Enable' })).toBeTruthy();
    expect(within(off).queryByRole('button', { name: 'Disable' })).toBeNull();
    expect(screen.getByRole('link', { name: /Users/ }).textContent).toContain('5');
  });

  it('filters by role and search', async () => {
    mockFetch(fixturePlan(), [], { me: ADMIN, routes: { '/api/admin/users': ok(USERS) } });
    renderApp('/admin');
    const card = await screen.findByLabelText('Users');
    fireEvent.click(within(card).getByRole('button', { name: 'Editors 1' }));
    expect(within(card).getAllByRole('row')).toHaveLength(2);
    expect(within(card).getByText('an@example.com')).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'All 5' }));
    fireEvent.change(within(card).getByLabelText('Search users'), { target: { value: 'minh' } });
    expect(within(card).getAllByRole('row')).toHaveLength(2);
  });

  it('changes a role at once and shows the toast; reverts on error', async () => {
    const fetch = mockFetch(fixturePlan(), [], {
      me: ADMIN,
      routes: {
        '/api/admin/users': ok(USERS),
        '/api/admin/users/2': ok({ ...USERS[1], role: 'viewer' }),
        '/api/admin/users/3': { status: 503, body: { error: 'db_unavailable' } },
      },
    });
    renderApp('/admin');
    await screen.findByLabelText('Users');
    fireEvent.change(screen.getByLabelText('Role for An Nguyen'), { target: { value: 'viewer' } });
    expect((await screen.findByRole('status')).textContent).toContain('An Nguyen is now a Viewer');
    const patch = fetch.mock.calls.find(([url]) => url === '/api/admin/users/2');
    expect(patch?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ role: 'viewer' });

    const minh = screen.getByLabelText('Role for Minh Tran') as HTMLSelectElement;
    fireEvent.change(minh, { target: { value: 'editor' } });
    expect((await screen.findByRole('alert')).textContent).toContain('database isn’t reachable');
    await waitFor(() => expect(minh.value).toBe('viewer'));
  });

  it('confirms disable, and cancel sends nothing', async () => {
    const fetch = mockFetch(fixturePlan(), [], {
      me: ADMIN,
      routes: {
        '/api/admin/users': ok(USERS),
        '/api/admin/users/3': ok({ ...USERS[2], disabled: true }),
      },
    });
    renderApp('/admin');
    await screen.findByLabelText('Users');
    fireEvent.click(within(row('minh@example.com')).getByRole('button', { name: 'Disable' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url === '/api/admin/users/3')).toBe(false);

    fireEvent.click(within(row('minh@example.com')).getByRole('button', { name: 'Disable' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(within(row('minh@example.com')).getByRole('button', { name: 'Disable' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(row('minh@example.com').textContent).toContain('Disabled'));
    const patch = fetch.mock.calls.find(([url]) => url === '/api/admin/users/3');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ disabled: true });
  });

  it('resets a password to 1111 after confirming', async () => {
    const fetch = mockFetch(fixturePlan(), [], {
      me: ADMIN,
      routes: {
        '/api/admin/users': ok(USERS),
        '/api/admin/users/3/reset-password': ok({ ...USERS[2], mustChangePassword: true }),
      },
    });
    renderApp('/admin');
    await screen.findByLabelText('Users');
    fireEvent.click(
      within(row('minh@example.com')).getByRole('button', { name: 'Reset password' })
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('The password becomes 1111');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset to 1111' }));
    expect((await screen.findByRole('status')).textContent).toContain('password is now 1111');
    expect(row('minh@example.com').textContent).toContain('Must update password');
    const call = fetch.mock.calls.find(([url]) => url === '/api/admin/users/3/reset-password');
    expect(call?.[1]?.method).toBe('POST');
  });
});

describe('admin page — import log', () => {
  it('shows outcomes newest first and pages with before', async () => {
    const fetch = mockFetch(fixturePlan(), [], {
      me: ADMIN,
      routes: {
        '/api/admin/users': ok(USERS),
        '/api/admin/imports': ok({
          items: [
            entry({ id: 4 }),
            entry({
              id: 3,
              outcome: 'needs_mapping',
              planId: null,
              current: false,
              detail: '3 new words',
            }),
            entry({ id: 2, outcome: 'forbidden', planId: null, current: false, detail: '' }),
          ],
          nextBefore: 2,
        }),
        '/api/admin/imports?before=2': ok({
          items: [
            entry({
              id: 1,
              outcome: 'invalid_plan',
              planId: null,
              current: false,
              detail: 'missing column(s)',
            }),
          ],
          nextBefore: null,
        }),
      },
    });
    renderApp('/admin/imports');
    const log = await screen.findByLabelText('Import log');
    for (const label of ['Imported', 'Needed mapping', 'Not allowed'])
      expect(within(log).getByText(label)).toBeTruthy();
    expect(log.textContent).toContain('plan #12 (current)');

    fireEvent.click(within(log).getByRole('button', { name: 'Older →' }));
    expect(await screen.findByText('Rejected')).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => url === '/api/admin/imports?before=2')).toBe(true);
    expect((screen.getByRole('button', { name: 'Older →' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('shows the empty state', async () => {
    mockFetch(fixturePlan(), [], {
      me: ADMIN,
      routes: {
        '/api/admin/users': ok(USERS),
        '/api/admin/imports': ok({ items: [], nextBefore: null }),
      },
    });
    renderApp('/admin/imports');
    expect(await screen.findByText('No imports yet')).toBeTruthy();
  });
});

describe('admin page — access', () => {
  it('tells non-admins it is admins only and never calls the admin API', async () => {
    const fetch = mockFetch(fixturePlan(), [], {
      me: { ...ADMIN, role: 'viewer' },
    });
    renderApp('/admin');
    expect(await screen.findByText('Admins only')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to timeline' }).getAttribute('href')).toBe('/');
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/admin'))).toBe(false);
  });
});
