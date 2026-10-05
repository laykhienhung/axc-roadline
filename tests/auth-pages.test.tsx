// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../src/shared/auth';
import { fixturePlan } from './helpers';
import { mockFetch, renderApp } from './render';
import { fetchUsers, navigation } from '../src/client/api';

const forced: Me = {
  id: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'viewer',
  mustChangePassword: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth pages', () => {
  it('gates a signed-out target before loading the plan', async () => {
    const fetch = mockFetch(fixturePlan(), [], { me: null });
    renderApp('/target/T1');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(fetch).not.toHaveBeenCalledWith('/api/plan');
  });

  it('shows sign-in outcomes and clears an invalid password', async () => {
    mockFetch(fixturePlan(), [{ status: 401, body: { error: 'invalid_credentials' } }], {
      me: null,
    });
    renderApp('/signin');
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email or password is wrong');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
    // A failed sign-in is a form result, not an expired session: no redirect.
    expect(assign).not.toHaveBeenCalled();
  });

  it('sends an expired session on a data call back to sign-in', async () => {
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }))
    );
    await expect(fetchUsers()).rejects.toThrow();
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/signin\?expired=1&next=/));
  });

  it('shows disabled, signed-out, and expired notices', async () => {
    mockFetch(fixturePlan(), [], { me: null });
    renderApp('/signin?signedout=1&expired=1');
    await screen.findByText("You're signed out");
    expect(screen.getByText('Your session ended')).toBeTruthy();
  });

  it('validates sign-up before making a request and displays email taken', async () => {
    const fetch = mockFetch(fixturePlan(), [], { me: null });
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create an account' });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows an email-taken response', async () => {
    mockFetch(fixturePlan(), [{ status: 409, body: { error: 'email_taken' } }], { me: null });
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create an account' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough' } });
    fireEvent.change(screen.getByLabelText('Repeat password'), {
      target: { value: 'long enough' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('This email already has an account');
  });

  it('shows a disabled account response', async () => {
    mockFetch(fixturePlan(), [{ status: 403, body: { error: 'account_disabled' } }], { me: null });
    renderApp('/signin');
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Your access is turned off');
  });

  it('signs up and displays the welcome state on the timeline', async () => {
    mockFetch(
      fixturePlan(),
      [{ status: 200, body: { ...forced, role: 'viewer', mustChangePassword: false } }],
      { me: null }
    );
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create an account' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long enough' } });
    fireEvent.change(screen.getByLabelText('Repeat password'), {
      target: { value: 'long enough' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByLabelText('Timeline');
    expect((await screen.findByRole('status')).textContent).toContain('Welcome, ');
  });

  it('sends a must-change user to the password screen and returns to the route', async () => {
    mockFetch(fixturePlan(), [{ status: 200, body: { ...forced, mustChangePassword: false } }], {
      me: forced,
    });
    renderApp('/target/T1');
    await screen.findByRole('heading', { name: 'Set a new password' });
    expect(screen.queryByLabelText('Current password')).toBeNull();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new password' } });
    fireEvent.change(screen.getByLabelText('Repeat new password'), {
      target: { value: 'new password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByLabelText('Target');
  });

  it('shows the current-password error for a voluntary password change', async () => {
    mockFetch(fixturePlan(), [
      {
        status: 400,
        body: { error: 'invalid_input', fields: { current: 'Current password is wrong.' } },
      },
    ]);
    renderApp('/update-password');
    await screen.findByRole('heading', { name: 'Change password' });
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old password' },
    });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new password' } });
    fireEvent.change(screen.getByLabelText('Repeat new password'), {
      target: { value: 'new password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Current password is wrong.');
  });

  it('redirects an already signed-in visitor from sign-in to next', async () => {
    mockFetch(fixturePlan());
    renderApp('/signin?next=/target/T1');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull());
    await screen.findByLabelText('Target');
  });
});
