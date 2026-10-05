import express, { type Express, type RequestHandler } from 'express';
import {
  normEmail,
  type Me,
  type Role,
  validateNewPassword,
  validateSignup,
} from '../shared/auth.js';
import type { AuthConfig } from './auth-config.js';
import type { AuthStore, UserRow } from './auth-store.js';
import { clearSessionCookie, readCookies, SESSION_COOKIE, setSessionCookie } from './cookies.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.js';

declare module 'express-serve-static-core' {
  interface Request {
    token?: string;
    user?: UserRow;
  }
}

export interface AuthRouteOptions {
  cfg: AuthConfig;
  store: AuthStore;
}

export interface AuthMiddleware {
  loadSession: RequestHandler;
  apiGate: RequestHandler;
  mustChangeGate: RequestHandler;
  pageGate: RequestHandler;
  requireRole: (minimum: Role) => RequestHandler;
  originCheck: RequestHandler;
}

const roleRank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

function toMe(user: UserRow): Me {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function currentOrigin(cfg: AuthConfig): string {
  return new URL(cfg.publicUrl).origin;
}

/** Build the request guards shared by the auth, API, and page routes. */
export function authMiddleware({ cfg, store }: AuthRouteOptions): AuthMiddleware {
  const loadSession: RequestHandler = async (req, _res, next) => {
    const token = readCookies(req)[SESSION_COOKIE];
    if (!token) return next();
    try {
      const user = await store.findSession(token);
      if (user) {
        req.token = token;
        req.user = user;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  const apiGate: RequestHandler = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    next();
  };

  const mustChangeGate: RequestHandler = (req, res, next) => {
    if (
      req.user?.mustChangePassword &&
      req.path !== '/api/me' &&
      !(req.path === '/api/me/password' && req.method === 'POST')
    ) {
      return res.status(403).json({ error: 'password_change_required' });
    }
    next();
  };

  const pageGate: RequestHandler = (req, res, next) => {
    if (
      req.user ||
      req.path === '/signin' ||
      req.path === '/signup' ||
      req.path === '/update-password' ||
      req.path.startsWith('/assets/')
    ) {
      return next();
    }
    res.redirect(302, `/signin?next=${encodeURIComponent(req.originalUrl)}`);
  };

  const requireRole =
    (minimum: Role): RequestHandler =>
    (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
      if (roleRank[req.user.role] < roleRank[minimum]) {
        return res.status(403).json({ error: 'forbidden' });
      }
      next();
    };

  const originCheck: RequestHandler = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.get('origin');
    if (origin && origin !== currentOrigin(cfg))
      return res.status(403).json({ error: 'bad_origin' });
    next();
  };

  return { loadSession, apiGate, mustChangeGate, pageGate, requireRole, originCheck };
}

/** Register unauthenticated auth endpoints and `/api/me` endpoints. */
export function authRoutes(app: Express, options: AuthRouteOptions): AuthMiddleware {
  const { cfg, store } = options;
  const middleware = authMiddleware(options);
  app.use(middleware.loadSession);
  app.use(['/auth', '/api/me'], middleware.originCheck);
  // Keep JSON body parsing limited to the small auth payloads.
  app.use(['/auth', '/api/me'], express.json({ limit: '10kb' }));

  app.post('/auth/signup', async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const input = {
      name: stringValue(body?.name),
      email: stringValue(body?.email),
      password: stringValue(body?.password),
      repeat: stringValue(body?.repeat),
    };
    const fields = validateSignup(input);
    if (Object.keys(fields).length > 0)
      return res.status(400).json({ error: 'invalid_input', fields });

    const email = normEmail(input.email);
    const user = await store.createUser({
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: cfg.adminEmails.includes(email) ? 'admin' : 'viewer',
    });
    if (user === 'email_taken') return res.status(409).json({ error: 'email_taken' });
    const token = await store.createSession(
      user.id,
      req.get('user-agent') ?? null,
      cfg.sessionHours
    );
    setSessionCookie(res, token, cfg);
    res.json(toMe(user));
  });

  app.post('/auth/signin', async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const email = normEmail(stringValue(body?.email));
    const password = stringValue(body?.password);
    const user = await store.findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      console.warn(`signin failed ${email}`);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (user.disabled) return res.status(403).json({ error: 'account_disabled' });

    const signedIn = await store.markSignedIn(user.id, cfg.adminEmails.includes(user.email));
    const token = await store.createSession(
      signedIn.id,
      req.get('user-agent') ?? null,
      cfg.sessionHours
    );
    setSessionCookie(res, token, cfg);
    res.json(toMe(signedIn));
  });

  app.post('/auth/signout', async (req, res) => {
    const token = readCookies(req)[SESSION_COOKIE];
    if (token) await store.deleteSession(token);
    clearSessionCookie(res, cfg);
    res.redirect(302, '/signin?signedout=1');
  });

  app.get('/api/me', middleware.apiGate, (req, res) => res.json(toMe(req.user!)));

  app.post('/api/me/password', middleware.apiGate, async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const user = req.user!;
    const current = stringValue(body?.current);
    const input = {
      password: stringValue(body?.password),
      repeat: stringValue(body?.repeat),
      ...(user.mustChangePassword ? {} : { current }),
    };
    const fields = validateNewPassword(input);
    if (!user.mustChangePassword && !(await verifyPassword(current, user.passwordHash))) {
      fields.current = 'Current password is wrong.';
    }
    if (Object.keys(fields).length > 0)
      return res.status(400).json({ error: 'invalid_input', fields });

    await store.setPassword(user.id, await hashPassword(input.password), false);
    await store.deleteUserSessions(user.id, req.token);
    res.json({ ...toMe(user), mustChangePassword: false });
  });

  app.all('/auth', (_req, res) => res.status(404).json({ error: 'not_found' }));
  app.all('/auth/*path', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // A failed sweep (e.g. DB unreachable) must never become an unhandled rejection: Node exits on those.
  const sweepOnce = () =>
    store.deleteExpiredSessions().catch((error: unknown) => {
      console.error(
        'roadline: session sweep failed',
        error instanceof Error ? error.message : error
      );
    });
  void sweepOnce();
  const sweep = setInterval(() => void sweepOnce(), 60 * 60 * 1000);
  sweep.unref();
  return middleware;
}
