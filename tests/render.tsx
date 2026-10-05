import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from '../src/client/app';
import type { Me } from '../src/shared/auth';
import type { Plan } from '../src/shared/model';

const EDITOR: Me = {
  id: 1,
  name: 'Test Editor',
  email: 'editor@example.com',
  role: 'editor',
  mustChangePassword: false,
};

/** Mock the session and plan endpoints, with optional POST and named-route responses. */
export function mockFetch(
  plan: Plan | null,
  posts: { status: number; body: unknown }[] = [],
  options: { me?: Me | null; routes?: Record<string, { status: number; body: unknown }> } = {}
) {
  const queue = [...posts];
  const me = options.me === undefined ? EDITOR : options.me;
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/me') {
      return me
        ? new Response(JSON.stringify(me), { status: 200 })
        : new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
    }
    const route = options.routes?.[url];
    if (route) return new Response(JSON.stringify(route.body), { status: route.status });
    if (init?.method && init.method !== 'GET') {
      const next = queue.shift() ?? { status: 500, body: {} };
      return new Response(JSON.stringify(next.body), { status: next.status });
    }
    return plan
      ? new Response(JSON.stringify(plan), { status: 200 })
      : new Response(JSON.stringify({ error: 'no_plan' }), { status: 404 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function renderApp(path: string) {
  if (!vi.isMockFunction(window.scrollTo)) window.scrollTo = vi.fn() as never; // jsdom has none
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}
