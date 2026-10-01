import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyMappings, type Mappings } from '../shared/model.js';
import { STATUS_ORDER } from '../shared/status.js';
import { normWord } from '../shared/suggest.js';

const MEANINGS = {
  status: new Set<string>(STATUS_ORDER),
  quarter: new Set(['Q1', 'Q2', 'Q3', 'Q4', 'ongoing', 'next_year']),
  due: new Set(['next_year', 'quarter_end']),
};

/**
 * Validate an uploaded `mapping` field (JSON). Keys are normalized; any unknown field or meaning
 * makes the whole mapping invalid (null).
 */
export function parseMappingField(raw: unknown): Mappings | null {
  if (raw === undefined || raw === '') return emptyMappings();
  let value: unknown;
  try {
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = emptyMappings();
  for (const [field, entries] of Object.entries(value as Record<string, unknown>)) {
    if (field !== 'status' && field !== 'quarter' && field !== 'due') return null;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return null;
    for (const [word, meaning] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof meaning !== 'string' || !MEANINGS[field].has(meaning)) return null;
      (out[field] as Record<string, string>)[normWord(word)] = meaning;
    }
  }
  return out;
}

/** Saved value mappings in `data/mappings.json`, shared by everyone. */
export class MappingStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataDir: string) {}

  private get file() {
    return path.join(this.dataDir, 'mappings.json');
  }

  async load(): Promise<Mappings> {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as Partial<Mappings>;
      return {
        status: saved.status ?? {},
        quarter: saved.quarter ?? {},
        due: saved.due ?? {},
        seenVersions: saved.seenVersions ?? [],
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyMappings();
      throw err;
    }
  }

  /** Merge submitted mappings (they win over saved ones) and remember a template version. */
  merge(partial: Mappings, version?: string | null): Promise<void> {
    const run = this.queue.then(async () => {
      const current = await this.load();
      const next: Mappings = {
        status: { ...current.status, ...partial.status },
        quarter: { ...current.quarter, ...partial.quarter },
        due: { ...current.due, ...partial.due },
        seenVersions: [
          ...new Set([...(current.seenVersions ?? []), ...(version ? [version] : [])]),
        ],
      };
      await mkdir(this.dataDir, { recursive: true });
      const tmp = path.join(this.dataDir, 'mappings.tmp.json');
      await writeFile(tmp, JSON.stringify(next, null, 2));
      await rename(tmp, this.file);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
