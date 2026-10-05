import type { Request, Response } from 'express';
import type { AuthConfig } from './auth-config.js';

export const SESSION_COOKIE = 'rl_session';

export function readCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const rawValue = part.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      // An invalid escape sequence is not a usable cookie value.
    }
  }
  return cookies;
}

function cookieOptions(cfg: AuthConfig) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cfg.secureCookies,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, cfg: AuthConfig): void {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(cfg),
    maxAge: cfg.sessionHours * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response, cfg: AuthConfig): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(cfg));
}
