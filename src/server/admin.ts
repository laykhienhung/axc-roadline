import express, { type Express } from 'express';
import { RESET_PASSWORD, type Role } from '../shared/auth.js';
import type { AuthConfig } from './auth-config.js';
import type { AuthStore } from './auth-store.js';
import type { AuthMiddleware } from './auth.js';
import { hashPassword } from './password.js';
import type { Storage } from './storage.js';

export interface AdminRouteOptions {
  cfg: AuthConfig;
  store: AuthStore;
  storage: Storage;
  middleware: AuthMiddleware;
}

const roles: Role[] = ['viewer', 'editor', 'admin'];

function userId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function paging(value: unknown, maximum: number): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

/** Register administration endpoints after the regular authenticated plan routes. */
export function adminRoutes(
  app: Express,
  { cfg, store, storage, middleware }: AdminRouteOptions
): void {
  const guard = [middleware.originCheck, middleware.requireRole('admin')];
  app.use('/api/admin', express.json({ limit: '10kb' }));

  app.get('/api/admin/users', ...guard, async (_req, res) => {
    res.json(await store.listUsers(cfg.adminEmails));
  });

  app.patch('/api/admin/users/:id', ...guard, async (req, res) => {
    const id = userId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const body = req.body as Record<string, unknown> | undefined;
    const keys = body ? Object.keys(body) : [];
    const role = body?.role;
    const disabled = body?.disabled;
    if (
      id === null ||
      keys.length !== 1 ||
      (keys[0] === 'role' && (typeof role !== 'string' || !roles.includes(role as Role))) ||
      (keys[0] === 'disabled' && typeof disabled !== 'boolean') ||
      (keys[0] !== 'role' && keys[0] !== 'disabled')
    ) {
      return res.status(400).json({ error: 'invalid_body' });
    }
    const users = await store.listUsers(cfg.adminEmails);
    const target = users.find((user) => user.id === id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (target.locked) return res.status(409).json({ error: 'locked' });
    if (id === req.user!.id) return res.status(409).json({ error: 'self' });
    await store.updateUser(
      id,
      keys[0] === 'role' ? { role: role as Role } : { disabled: disabled as boolean }
    );
    const updated = (await store.listUsers(cfg.adminEmails)).find((user) => user.id === id);
    res.json(updated);
  });

  app.post('/api/admin/users/:id/reset-password', ...guard, async (req, res) => {
    const id = userId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (id === null) return res.status(404).json({ error: 'not_found' });
    const users = await store.listUsers(cfg.adminEmails);
    const target = users.find((user) => user.id === id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (target.locked) return res.status(409).json({ error: 'locked' });
    if (id === req.user!.id) return res.status(409).json({ error: 'self' });
    await store.setPassword(id, await hashPassword(RESET_PASSWORD), true);
    res.json((await store.listUsers(cfg.adminEmails)).find((user) => user.id === id));
  });

  app.post('/api/admin/users/:id/signout-all', ...guard, async (req, res) => {
    const id = userId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    if (id === null) return res.status(404).json({ error: 'not_found' });
    const users = await store.listUsers(cfg.adminEmails);
    if (!users.some((user) => user.id === id)) return res.status(404).json({ error: 'not_found' });
    if (id === req.user!.id) return res.status(409).json({ error: 'self' });
    res.json({ revoked: await store.deleteUserSessions(id) });
  });

  app.get('/api/admin/imports', ...guard, async (req, res) => {
    const before = paging(req.query.before, Number.MAX_SAFE_INTEGER);
    const limit = req.query.limit === undefined ? 50 : paging(req.query.limit, 50);
    if (before === null || limit === null) return res.status(400).json({ error: 'invalid_body' });
    res.json(await storage.listImports({ before, limit: limit ?? 50 }));
  });
}
