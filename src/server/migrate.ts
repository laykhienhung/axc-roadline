import { runner } from 'node-pg-migrate';

try {
  process.loadEnvFile();
} catch {
  // A local .env file is optional.
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

await runner({
  databaseUrl,
  dir: 'migrations',
  direction: 'up',
  schema: 'roadline',
  migrationsSchema: 'roadline',
  migrationsTable: 'pgmigrations',
  checkOrder: true,
});
