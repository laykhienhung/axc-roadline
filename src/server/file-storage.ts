import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImportLogItem } from '../shared/auth.js';
import type { Mappings, Plan } from '../shared/model.js';
import { MappingStore } from './mapping-store.js';
import { PlanStore } from './plan-store.js';
import { importDetail, type CommitImport, type ImportEntry, type Storage } from './storage.js';

/** JSON-file implementation used when PostgreSQL is not configured and in automated tests. */
export class FileStorage implements Storage {
  private readonly planStore: PlanStore;
  private readonly mappingStore: MappingStore;

  constructor(private readonly dataDir: string) {
    this.planStore = new PlanStore(dataDir);
    this.mappingStore = new MappingStore(dataDir);
  }

  loadPlan(): Promise<Plan | null> {
    return this.planStore.load();
  }

  loadMappings(): Promise<Mappings> {
    return this.mappingStore.load();
  }

  async commitImport({
    plan,
    file,
    fileName,
    submitted,
    templateVersion,
    userEmail,
  }: CommitImport) {
    await this.planStore.save(plan, file, fileName);
    await this.mappingStore.merge(submitted, templateVersion);
    await this.logImport({
      userEmail,
      fileName,
      fileSize: file.length,
      outcome: 'ok',
    });
  }

  async logImport(entry: ImportEntry): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await appendFile(
      path.join(this.dataDir, 'imports.jsonl'),
      `${JSON.stringify({
        at: new Date().toISOString(),
        ...entry,
      })}\n`
    );
  }

  async listImports({ before, limit }: { before?: number; limit: number }): Promise<{
    items: ImportLogItem[];
    nextBefore: number | null;
  }> {
    let lines: string[] = [];
    try {
      lines = (await readFile(path.join(this.dataDir, 'imports.jsonl'), 'utf8'))
        .split('\n')
        .filter(Boolean);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const entries = lines.flatMap((line, index) => {
      try {
        return [
          { id: index + 1, ...(JSON.parse(line) as Omit<ImportEntry & { at: string }, 'id'>) },
        ];
      } catch {
        return [];
      }
    });
    const latestPlanId = entries.reduce<number | null>(
      (latest, entry) => (entry.outcome === 'ok' ? entry.id : latest),
      null
    );
    const matching = entries.filter((entry) => before === undefined || entry.id < before).reverse();
    const page = matching.slice(0, limit + 1);
    const hasMore = page.length > limit;
    return {
      items: page.slice(0, limit).map((entry) => {
        const planId = entry.outcome === 'ok' ? entry.id : null;
        return {
          id: entry.id,
          at: entry.at,
          userEmail: entry.userEmail,
          fileName: entry.fileName,
          fileSize: entry.fileSize,
          outcome: entry.outcome,
          planId,
          current: planId === latestPlanId,
          detail: importDetail({ ...entry, planId }),
        };
      }),
      nextBefore: hasMore ? (page[limit - 1]?.id ?? null) : null,
    };
  }

  async close(): Promise<void> {}
}
