import type { Mappings, Plan } from '../shared/model.js';
import type { ImportLogItem } from '../shared/auth.js';

export interface ImportEntry {
  userEmail: string | null;
  fileName: string | null;
  fileSize: number | null;
  outcome:
    | 'ok'
    | 'invalid_plan'
    | 'needs_mapping'
    | 'invalid_mapping'
    | 'no_file'
    | 'file_too_large'
    | 'unsupported_type'
    | 'forbidden';
  problems?: unknown;
}

export interface CommitImport {
  plan: Plan;
  file: Buffer;
  fileName: string;
  submitted: Mappings;
  templateVersion: string | null;
  userEmail: string | null;
}

export interface Storage {
  loadPlan(): Promise<Plan | null>;
  loadMappings(): Promise<Mappings>;
  commitImport(commit: CommitImport): Promise<void>;
  logImport(entry: ImportEntry): Promise<void>;
  listImports(options: {
    before?: number;
    limit: number;
  }): Promise<{ items: ImportLogItem[]; nextBefore: number | null }>;
  close(): Promise<void>;
}

export function importDetail(entry: {
  outcome: ImportEntry['outcome'];
  planId: number | null;
  problems?: unknown;
}): string {
  if (entry.outcome === 'ok') return `plan #${entry.planId ?? '?'}`;
  if (entry.outcome === 'needs_mapping') {
    return `${Array.isArray(entry.problems) ? entry.problems.length : 0} new words`;
  }
  const first = Array.isArray(entry.problems) ? entry.problems[0] : undefined;
  const detail =
    typeof first === 'string'
      ? first
      : first &&
          typeof first === 'object' &&
          'message' in first &&
          typeof first.message === 'string'
        ? first.message
        : '';
  return detail.length > 80 ? `${detail.slice(0, 80)}…` : detail;
}

export class StorageUnavailableError extends Error {}
