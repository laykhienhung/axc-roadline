import type { Pool, PoolClient } from 'pg';
import { emptyMappings, type MappingField, type Mappings, type Plan } from '../shared/model.js';
import type { ImportLogItem } from '../shared/auth.js';
import {
  importDetail,
  StorageUnavailableError,
  type CommitImport,
  type ImportEntry,
  type Storage,
} from './storage.js';

export interface MappingRow {
  kind: MappingField;
  word: string;
  meaning: string;
}

interface PlanRow {
  plan: Plan;
}

interface IdRow {
  id: number;
}

interface ImportRow {
  id: number | string;
  at: Date | string;
  user_email: string | null;
  file_name: string | null;
  file_size: number | null;
  outcome: ImportEntry['outcome'];
  problems: unknown;
  plan_id: number | string | null;
  current: boolean;
}

/** Flatten mappings into the rows used by value_mappings. */
export function mappingsToRows(mappings: Mappings): MappingRow[] {
  return [
    ...Object.entries(mappings.status).map(([word, meaning]) => ({
      kind: 'status' as const,
      word,
      meaning,
    })),
    ...Object.entries(mappings.quarter).map(([word, meaning]) => ({
      kind: 'quarter' as const,
      word,
      meaning,
    })),
    ...Object.entries(mappings.due).map(([word, meaning]) => ({
      kind: 'due' as const,
      word,
      meaning,
    })),
  ];
}

/** Rebuild the file-store mapping shape from database rows and remembered template versions. */
export function rowsToMappings(rows: MappingRow[], versions: string[]): Mappings {
  const mappings = emptyMappings();
  for (const { kind, word, meaning } of rows) {
    if (kind === 'status') mappings.status[word] = meaning as Mappings['status'][string];
    if (kind === 'quarter') mappings.quarter[word] = meaning as Mappings['quarter'][string];
    if (kind === 'due') mappings.due[word] = meaning as Mappings['due'][string];
  }
  if (versions.length > 0) mappings.seenVersions = versions;
  return mappings;
}

function unavailable(error: unknown): StorageUnavailableError {
  if (error instanceof StorageUnavailableError) return error;
  const message = error instanceof Error ? error.message : 'PostgreSQL storage unavailable';
  return new StorageUnavailableError(message);
}

/** PostgreSQL-backed storage. Successful imports are committed in one database transaction. */
export class PgStorage implements Storage {
  constructor(private readonly pool: Pool) {}

  async loadPlan(): Promise<Plan | null> {
    try {
      const result = await this.pool.query<PlanRow>(
        'select plan from plans order by id desc limit 1'
      );
      return result.rows[0]?.plan ?? null;
    } catch (error) {
      throw unavailable(error);
    }
  }

  async loadMappings(): Promise<Mappings> {
    try {
      const [mappings, versions] = await Promise.all([
        this.pool.query<MappingRow>('select kind, word, meaning from value_mappings'),
        this.pool.query<{ version: string }>('select version from template_versions'),
      ]);
      return rowsToMappings(
        mappings.rows,
        versions.rows.map(({ version }) => version)
      );
    } catch (error) {
      throw unavailable(error);
    }
  }

  async commitImport(commit: CommitImport): Promise<void> {
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw unavailable(error);
    }

    try {
      await client.query('BEGIN');
      const planResult = await client.query<IdRow>(
        `insert into plans (plan, file_name, file, template_version, imported_by)
         values ($1, $2, $3, $4, $5) returning id`,
        [
          JSON.stringify(commit.plan),
          commit.fileName,
          commit.file,
          commit.templateVersion,
          commit.userEmail,
        ]
      );
      const planId = planResult.rows[0]?.id;
      if (planId === undefined) throw new Error('PostgreSQL did not return an imported plan id');

      for (const row of mappingsToRows(commit.submitted)) {
        await client.query(
          `insert into value_mappings (kind, word, meaning, updated_by)
           values ($1, $2, $3, $4)
           on conflict (kind, word) do update
           set meaning = excluded.meaning, updated_at = now(), updated_by = excluded.updated_by`,
          [row.kind, row.word, row.meaning, commit.userEmail]
        );
      }
      if (commit.templateVersion) {
        await client.query(
          'insert into template_versions (version) values ($1) on conflict do nothing',
          [commit.templateVersion]
        );
      }
      await client.query(
        'delete from plans where id not in (select id from plans order by id desc limit 10)'
      );
      await client.query(
        `insert into imports (user_email, file_name, file_size, outcome, plan_id)
         values ($1, $2, $3, 'ok', $4)`,
        [commit.userEmail, commit.fileName, commit.file.length, planId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw unavailable(error);
    } finally {
      client.release();
    }
  }

  async logImport(entry: ImportEntry): Promise<void> {
    try {
      await this.pool.query(
        `insert into imports (user_email, file_name, file_size, outcome, problems)
         values ($1, $2, $3, $4, $5)`,
        [
          entry.userEmail,
          entry.fileName,
          entry.fileSize,
          entry.outcome,
          // node-postgres sends JS arrays as Postgres arrays, not JSON; jsonb needs a JSON string.
          entry.problems === undefined ? null : JSON.stringify(entry.problems),
        ]
      );
    } catch (error) {
      throw unavailable(error);
    }
  }

  async listImports({ before, limit }: { before?: number; limit: number }): Promise<{
    items: ImportLogItem[];
    nextBefore: number | null;
  }> {
    try {
      const result = await this.pool.query<ImportRow>(
        `select id, at, user_email, file_name, file_size, outcome, problems, plan_id,
                plan_id is not null and plan_id = (select max(id) from plans) as current
         from imports
         where ($1::bigint is null or id < $1)
         order by id desc limit $2`,
        [before ?? null, limit + 1]
      );
      const rows = result.rows;
      const hasMore = rows.length > limit;
      return {
        items: rows.slice(0, limit).map((row) => {
          const planId = row.plan_id === null ? null : Number(row.plan_id);
          const problems =
            typeof row.problems === 'string' ? (JSON.parse(row.problems) as unknown) : row.problems;
          return {
            id: Number(row.id),
            at: row.at instanceof Date ? row.at.toISOString() : row.at,
            userEmail: row.user_email,
            fileName: row.file_name,
            fileSize: row.file_size,
            outcome: row.outcome,
            planId,
            current: row.current,
            detail: importDetail({ outcome: row.outcome, planId, problems }),
          };
        }),
        nextBefore: hasMore ? Number(rows[limit - 1]?.id) : null,
      };
    } catch (error) {
      throw unavailable(error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      throw unavailable(error);
    }
  }
}
