import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { emptyMappings, type Mappings, type Plan } from '../shared/model.js';
import { createPool } from './db.js';
import { mappingsToRows, PgStorage } from './pg-storage.js';

interface CountRow {
  count: string;
}

function uploadName(importedAt: string, fileName: string): string {
  const stamp = importedAt.replace(/[:.]/g, '-');
  const safeName = path.basename(fileName).replace(/[^\w.-]+/g, '_');
  return `${stamp}-${safeName}`;
}

/** Find the raw upload written by PlanStore for an imported plan. */
export function matchUpload(
  files: string[],
  importedAt: string,
  fileName: string
): string | undefined {
  const expected = uploadName(importedAt, fileName);
  return files.find((file) => path.basename(file) === expected);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function uploadFiles(uploadsDir: string): Promise<string[]> {
  try {
    return await readdir(uploadsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function importMappings(pool: Pool, mappings: Mappings): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of mappingsToRows(mappings)) {
      await client.query(
        `insert into value_mappings (kind, word, meaning)
         values ($1, $2, $3)
         on conflict (kind, word) do update set meaning = excluded.meaning, updated_at = now()`,
        [row.kind, row.word, row.meaning]
      );
    }
    for (const version of mappings.seenVersions ?? []) {
      await client.query(
        'insert into template_versions (version) values ($1) on conflict do nothing',
        [version]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // A local .env file is optional.
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
  const pool = createPool(databaseUrl);
  try {
    const existing = await pool.query<CountRow>('select count(*) from plans');
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      console.error('plans already has rows — nothing imported');
      process.exitCode = 1;
      return;
    }

    const files = await uploadFiles(path.join(dataDir, 'uploads'));
    const storage = new PgStorage(pool);
    let plansImported = 0;
    for (const name of ['plan.prev.json', 'plan.json']) {
      const plan = await readJson<Plan>(path.join(dataDir, name));
      if (!plan) continue;

      const upload = matchUpload(files, plan.source.importedAt, plan.source.fileName);
      const file = upload ? await readFile(path.join(dataDir, 'uploads', upload)) : Buffer.alloc(0);
      if (!upload) {
        console.warn(
          `warning: no raw upload found for ${plan.source.fileName}; importing empty file`
        );
      }
      await storage.commitImport({
        plan,
        file,
        fileName: plan.source.fileName,
        submitted: emptyMappings(),
        templateVersion: plan.templateVersion,
        userEmail: null,
      });
      plansImported += 1;
    }

    const mappings =
      (await readJson<Mappings>(path.join(dataDir, 'mappings.json'))) ?? emptyMappings();
    await importMappings(pool, mappings);
    console.log(
      `imported ${plansImported} plans, ${mappingsToRows(mappings).length} mappings, ${(mappings.seenVersions ?? []).length} versions`
    );
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`roadline: ${message}`);
    process.exitCode = 1;
  });
}
