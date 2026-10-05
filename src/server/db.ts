import { Pool } from 'pg';
import type { Pool as PgPool } from 'pg';
import { SUPABASE_CA } from './supabase-ca.js';

/** Create the small, process-wide pool used by the PostgreSQL storage implementation. */
export function createPool(url: string, serverless = false): PgPool {
  const connection = new URL(url);
  // URL SSL parameters can override node-postgres's verified TLS settings.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'])
    connection.searchParams.delete(key);
  const supabase =
    connection.hostname.endsWith('.pooler.supabase.com') ||
    /^db\.[^.]+\.supabase\.co$/.test(connection.hostname);
  return new Pool({
    connectionString: connection.toString(),
    max: serverless ? 1 : 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true, ...(supabase ? { ca: SUPABASE_CA } : {}) },
    application_name: 'roadline',
  });
}

/** Ensure migrations have created the schema before the application starts using it. */
export async function checkSchema(pool: PgPool): Promise<void> {
  const result = await pool.query<{ present: number }>(
    "select 1 as present from pg_namespace where nspname = 'roadline'"
  );
  if (result.rowCount === 0) {
    throw new Error(
      `schema "roadline" not found in database ${describeUrl(pool.options.connectionString ?? '')}`
    );
  }
}

/** Return the safe host/database portion of a PostgreSQL URL, without credentials or query data. */
export function describeUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}`;
}
