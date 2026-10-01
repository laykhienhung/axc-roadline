import type { AppliedMapping, Mappings, Plan, Problem, UnknownValue } from '../shared/model';

export type UploadResult =
  | { ok: true; plan: Plan; warnings: Problem[]; applied: AppliedMapping[] }
  | { ok: false; problems: Problem[] }
  | { ok: false; needsMapping: UnknownValue[] };

/** GET /api/plan → the shared plan, or null when nothing has been imported. */
export async function fetchPlan(): Promise<Plan | null> {
  const res = await fetch('/api/plan');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/plan failed (${res.status})`);
  return (await res.json()) as Plan;
}

/** Upload a plan file, optionally with the value mappings chosen in the mapping dialog. */
export async function uploadPlan(
  file: File,
  mapping?: Omit<Mappings, 'seenVersions'>
): Promise<UploadResult> {
  const body = new FormData();
  if (mapping) body.append('mapping', JSON.stringify(mapping));
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch('/api/plan', { method: 'POST', body });
  } catch {
    return { ok: false, problems: [{ message: 'upload failed — is the server reachable?' }] };
  }
  const json = await res.json().catch(() => ({}));
  if (res.ok)
    return {
      ok: true,
      plan: json.plan,
      warnings: json.warnings ?? [],
      applied: json.applied ?? [],
    };
  if (res.status === 422 && Array.isArray(json.unknown))
    return { ok: false, needsMapping: json.unknown };
  if (res.status === 413) return { ok: false, problems: [{ message: 'file is larger than 5 MB' }] };
  if (res.status === 415)
    return { ok: false, problems: [{ message: 'only .xlsx and .csv files can be imported' }] };
  if (json.error === 'invalid_mapping')
    return { ok: false, problems: [{ message: 'the chosen mapping was not accepted' }] };
  return {
    ok: false,
    problems: json.problems ?? [{ message: `import failed (${res.status})` }],
  };
}
