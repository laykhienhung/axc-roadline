import { Pool } from 'pg';
import type { Pool as PgPool } from 'pg';

/** Create the small, process-wide pool used by the PostgreSQL storage implementation. */
export function createPool(url: string): PgPool {
  return new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 5000,
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
