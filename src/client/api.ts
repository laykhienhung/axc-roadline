import type { AdminUser, FieldErrors, ImportLogItem, Me, Role } from '../shared/auth';
import type { AppliedMapping, Mappings, Plan, Problem, UnknownValue } from '../shared/model';

export type UploadResult =
  | { ok: true; plan: Plan; warnings: Problem[]; applied: AppliedMapping[] }
  | { ok: false; problems: Problem[] }
  | { ok: false; needsMapping: UnknownValue[] };

interface ApiErrorBody {
  error?: string;
  fields?: FieldErrors;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody = {}
  ) {
    super(body.error ?? `Request failed (${status})`);
  }
}

function currentNext(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Full-page navigation, behind an object so tests can observe it (jsdom can't navigate). */
export const navigation = {
  assign: (url: string) => window.location.assign(url),
};

function handleAuthFailure(res: Response, body: ApiErrorBody): void {
  if (res.status === 401) {
    navigation.assign(`/signin?expired=1&next=${encodeURIComponent(currentNext())}`);
  }
  if (res.status === 403 && body.error === 'password_change_required') {
    navigation.assign(`/update-password?next=${encodeURIComponent(currentNext())}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!res.ok) {
    // /auth/* answers 401/403 as form results (wrong password, disabled), not as an expired session.
    if (!path.startsWith('/auth/')) handleAuthFailure(res, body);
    throw new ApiError(res.status, body);
  }
  return body;
}

function json(body: object, method = 'POST'): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/** GET /api/me. A missing session is the normal signed-out state. */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch('/api/me');
  if (res.status === 401) return null;
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & Me;
  if (!res.ok) {
    handleAuthFailure(res, body);
    throw new ApiError(res.status, body);
  }
  return body;
}

export const signUp = (input: { name: string; email: string; password: string; repeat: string }) =>
  request<Me>('/auth/signup', json(input));
export const signIn = (input: { email: string; password: string }) =>
  request<Me>('/auth/signin', json(input));
export const changePassword = (input: { current?: string; password: string; repeat: string }) =>
  request<Me>('/api/me/password', json(input));
export const fetchUsers = () => request<AdminUser[]>('/api/admin/users');
export const patchUser = (id: number, patch: { role?: Role; disabled?: boolean }) =>
  request<AdminUser>(`/api/admin/users/${id}`, json(patch, 'PATCH'));
export const resetPassword = (id: number) =>
  request<AdminUser>(`/api/admin/users/${id}/reset-password`, json({}));
export const signOutAll = (id: number) =>
  request<{ revoked: number }>(`/api/admin/users/${id}/signout-all`, json({}));
export const fetchImports = (before?: number) =>
  request<{ items: ImportLogItem[]; nextBefore: number | null }>(
    `/api/admin/imports${before === undefined ? '' : `?before=${before}`}`
  );

/** GET /api/plan → the shared plan, or null when nothing has been imported. */
export async function fetchPlan(): Promise<Plan | null> {
  const res = await fetch('/api/plan');
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & Plan;
  if (!res.ok) {
    handleAuthFailure(res, body);
    throw new ApiError(res.status, body);
  }
  return body;
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
  const data = await res.json().catch(() => ({}));
  if (res.ok)
    return {
      ok: true,
      plan: data.plan,
      warnings: data.warnings ?? [],
      applied: data.applied ?? [],
    };
  if (res.status === 401 || (res.status === 403 && data.error === 'password_change_required')) {
    handleAuthFailure(res, data);
  }
  if (res.status === 403 && data.error === 'forbidden') {
    return { ok: false, problems: [{ message: 'Only editors can import the plan.' }] };
  }
  if (res.status === 422 && Array.isArray(data.unknown))
    return { ok: false, needsMapping: data.unknown };
  if (res.status === 413) return { ok: false, problems: [{ message: 'file is larger than 5 MB' }] };
  if (res.status === 415)
    return { ok: false, problems: [{ message: 'only .xlsx and .csv files can be imported' }] };
  if (data.error === 'invalid_mapping')
    return { ok: false, problems: [{ message: 'the chosen mapping was not accepted' }] };
  return { ok: false, problems: data.problems ?? [{ message: `import failed (${res.status})` }] };
}
