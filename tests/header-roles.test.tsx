// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../src/shared/auth';
import { fixturePlan } from './helpers';
import { mockFetch, renderApp } from './render';

const viewer: Me = {
  id: 2,
  name: 'Minh Tran',
  email: 'minh@example.com',
  role: 'viewer',
  mustChangePassword: false,
};

const admin: Me = {
  ...viewer,
  id: 3,
  name: 'An Nguyen',
  email: 'admin@example.com',
  role: 'admin',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('header roles', () => {
  it('shows import controls and the editor account chip', async () => {
    mockFetch(fixturePlan());
    renderApp('/');
    expect(await screen.findByRole('button', { name: 'Import workbook' })).toBeTruthy();
    expect(screen.getByLabelText('Account: Test Editor (Editor)')).toBeTruthy();
  });

  it('shows the admin menu entry', async () => {
    mockFetch(fixturePlan(), [], { me: admin });
    renderApp('/');
    const chip = await screen.findByLabelText('Account: An Nguyen (Admin)');
    expect(chip.textContent).toContain('Admin');
    fireEvent.click(chip);
    expect(
      screen.getByRole('link', { name: 'Admin · users & import log' }).getAttribute('href')
    ).toBe('/admin');
  });

  it('keeps viewer pages read-only, including target pages', async () => {
    mockFetch(fixturePlan(), [], { me: viewer });
    renderApp('/');
    expect(await screen.findByText('Read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import workbook' })).toBeNull();
    expect(screen.queryByTestId('import-input')).toBeNull();
    expect(screen.getByLabelText('Account: Minh Tran (Viewer)')).toBeTruthy();

    cleanup();
    mockFetch(fixturePlan(), [], { me: viewer });
    renderApp('/target/T1');
    expect(await screen.findByLabelText('Target')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Import workbook' })).toBeNull();
    expect(screen.queryByTestId('import-input')).toBeNull();
    expect(screen.getByLabelText('Account: Minh Tran (Viewer)')).toBeTruthy();
  });

  it('shows account actions and closes the menu on Escape', async () => {
    mockFetch(fixturePlan(), [], { me: viewer });
    renderApp('/');
    const chip = await screen.findByLabelText('Account: Minh Tran (Viewer)');
    fireEvent.click(chip);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('minh@example.com')).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe(
      '/update-password'
    );
    const form = within(menu).getByRole('button', { name: 'Sign out' }).closest('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/auth/signout');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('uses the viewer empty state without an upload control', async () => {
    mockFetch(null, [], { me: viewer });
    renderApp('/missing');
    const empty = await screen.findByLabelText('No plan loaded');
    expect(empty.textContent).toContain('Ask an editor to import the workbook');
    expect(empty.querySelector('[data-testid="import-input"]')).toBeNull();

    cleanup();
    mockFetch(null);
    renderApp('/missing');
    const editorEmpty = await screen.findByLabelText('No plan loaded');
    expect(editorEmpty.textContent).toContain('Drop the workbook here');
  });

  it('shows the role refusal after an upload attempt', async () => {
    const fetch = mockFetch(fixturePlan(), [{ status: 403, body: { error: 'forbidden' } }]);
    renderApp('/');
    await screen.findByLabelText('Timeline');
    const input = screen.getByTestId('import-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'plan.xlsx')] } });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Only editors can import the plan.'
    );
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });
});
