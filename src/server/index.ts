import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { createApp } from './app.js';
import { readAuthConfig } from './auth-config.js';
import { FileAuthStore } from './file-auth-store.js';
import { createPool, checkSchema, describeUrl } from './db.js';
import { FileStorage } from './file-storage.js';
import { PgStorage } from './pg-storage.js';
import { PgAuthStore } from './pg-auth-store.js';
import type { Storage } from './storage.js';

try {
  process.loadEnvFile();
} catch {
  // A local .env file is optional.
}

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
const databaseUrl = process.env.DATABASE_URL;
// Built layout: dist/server/index.js next to dist/client/.
const clientDir = path.resolve(process.env.CLIENT_DIR ?? path.join(here, '../client'));
// Running from source (`npm run dev` via tsx): the page comes from the Vite dev server.
const fromSource = import.meta.url.endsWith('.ts');
const devClientUrl =
  process.env.DEV_CLIENT_URL ?? (fromSource ? 'http://localhost:5173' : undefined);

async function start(): Promise<void> {
  let storage: Storage;
  const auth = readAuthConfig(process.env, { port, devClientUrl });
  let authStore: FileAuthStore | PgAuthStore;

  if (databaseUrl) {
    if (process.env.DB_MIGRATE_ON_START === '1') {
      await runner({
        databaseUrl,
        dir: 'migrations',
        direction: 'up',
        schema: 'roadline',
        migrationsSchema: 'roadline',
        migrationsTable: 'pgmigrations',
        checkOrder: true,
      });
    }
    const pool = createPool(databaseUrl);
    await checkSchema(pool);
    storage = new PgStorage(pool);
    authStore = new PgAuthStore(pool);
    console.log(`storage: postgres ${describeUrl(databaseUrl)}`);
  } else {
    storage = new FileStorage(dataDir);
    authStore = new FileAuthStore(dataDir);
    console.log(`storage: files ${dataDir}`);
  }

  if (auth.adminEmails.length === 0) {
    console.warn('roadline: no ADMIN_EMAILS — nobody can manage users');
  }

  const server = createApp({
    dataDir,
    clientDir,
    devClientUrl,
    storage,
    auth: { cfg: auth, store: authStore },
  }).listen(port, () => {
    console.log(`roadline listening on http://localhost:${port} (data: ${dataDir})`);
    if (devClientUrl)
      console.log(`dev mode: web page at ${devClientUrl} (page requests redirect there)`);
  });

  let stopping = false;
  const close = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await storage.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`roadline: ${redactDatabaseUrl(message)}`);
    }
    process.exit(0);
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`roadline: ${redactDatabaseUrl(message)}`);
  process.exit(1);
});

function redactDatabaseUrl(message: string): string {
  return databaseUrl ? message.replaceAll(databaseUrl, '[redacted]') : message;
}
