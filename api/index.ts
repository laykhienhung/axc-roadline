import { createApp } from '../src/server/app.js';
import { readAuthConfig } from '../src/server/auth-config.js';
import { createPool } from '../src/server/db.js';
import { PgStorage } from '../src/server/pg-storage.js';
import { PgAuthStore } from '../src/server/pg-auth-store.js';

// Vercel serverless entry: the API only. Vercel serves the built page from dist/client.
// Only /tmp is writable on Vercel, and it is wiped whenever an instance is recycled.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the Vercel API');
const pool = createPool(databaseUrl, true);

export default createApp({
  dataDir: process.env.DATA_DIR ?? '/tmp/roadline-data',
  clientDir: '/nonexistent',
  storage: new PgStorage(pool),
  auth: {
    cfg: readAuthConfig(process.env, { port: Number(process.env.PORT ?? 3000) }),
    store: new PgAuthStore(pool),
  },
});
