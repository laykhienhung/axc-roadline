import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileStorage } from '../src/server/file-storage';
import { matchUpload } from '../src/server/import-files';
import { mappingsToRows, rowsToMappings } from '../src/server/pg-storage';
import { emptyMappings } from '../src/shared/model';
import { FIXTURE, V21_MAPPINGS, fixturePlan } from './helpers';

describe('PostgreSQL mapping helpers', () => {
  it('matches an upload using the stamp and safe filename written by PlanStore', () => {
    const importedAt = '2026-09-28T07:02:00.000Z';
    const upload = '2026-09-28T07-02-00-000Z-AXC_plan_2026.xlsx';

    expect(matchUpload([upload], importedAt, 'AXC plan 2026.xlsx')).toBe(upload);
    expect(matchUpload([upload], importedAt, 'other.xlsx')).toBeUndefined();
  });

  it('round trips mapping rows and remembered versions', () => {
    expect(rowsToMappings(mappingsToRows(V21_MAPPINGS), ['2.1'])).toEqual({
      ...V21_MAPPINGS,
      seenVersions: ['2.1'],
    });
  });

  it('returns empty mappings for empty rows and versions', () => {
    expect(rowsToMappings([], [])).toEqual(emptyMappings());
  });
});

describe('FileStorage contract', () => {
  it('loads a committed plan and merges mappings with its template version', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'roadline-storage-'));
    const storage = new FileStorage(dataDir);
    const plan = fixturePlan();
    const file = readFileSync(FIXTURE);

    expect(await storage.loadPlan()).toBeNull();
    await storage.commitImport({
      plan,
      file,
      fileName: 'axc-fy2026-27.xlsx',
      submitted: V21_MAPPINGS,
      templateVersion: '2.1',
      userEmail: null,
    });

    expect(await storage.loadPlan()).toEqual(plan);
    expect(await storage.loadMappings()).toEqual({ ...V21_MAPPINGS, seenVersions: ['2.1'] });
  });
});
