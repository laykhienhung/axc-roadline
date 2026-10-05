export interface AuthConfig {
  adminEmails: string[];
  publicUrl: string;
  sessionHours: number;
  secureCookies: boolean;
}

export interface AuthConfigOptions {
  port: number;
  devClientUrl?: string;
}

function normalizedList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readSessionHours(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

export function readAuthConfig(
  env: NodeJS.ProcessEnv,
  { port, devClientUrl }: AuthConfigOptions
): AuthConfig {
  const publicUrl = env.PUBLIC_URL?.trim() || devClientUrl || `http://localhost:${port}`;
  return {
    adminEmails: normalizedList(env.ADMIN_EMAILS),
    publicUrl,
    sessionHours: readSessionHours(env.SESSION_HOURS),
    secureCookies: new URL(publicUrl).protocol === 'https:',
  };
}
