// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_V21, fixturePlan, fixturePlanV21, parseFixture } from './helpers';
import { mockFetch, renderApp } from './render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pick = (name: string) => {
  const input = screen.getAllByTestId('import-input')[0] as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], name)] } });
};

describe('import from the page', () => {
  it('shows the empty state when nothing is imported', async () => {
    mockFetch(null);
    renderApp('/');
    const empty = await screen.findByLabelText('No plan loaded');
    expect(within(empty).getByText('Drop the workbook here')).toBeTruthy();
    expect(empty.textContent).toContain('AXC workbook');
    expect(empty.textContent).toContain('Flat CSV');
    expect(within(empty).getByRole('button', { name: 'Choose file…' })).toBeTruthy();
  });

  it('imports a file and shows the new plan', async () => {
    const plan = fixturePlan();
    plan.source = { fileName: 'new-plan.xlsx', importedAt: '2026-09-29T02:30:00.000Z' };
    const fetch = mockFetch(null, [{ status: 200, body: { plan, warnings: [] } }]);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('No plan loaded');
    pick('new-plan.xlsx');
    expect(screen.getByLabelText('Importing').textContent).toContain('new-plan.xlsx');
    await screen.findByLabelText('Timeline');
    expect(screen.getByRole('banner').textContent).toContain('from new-plan.xlsx');
    expect(screen.queryByLabelText('Importing')).toBeNull();
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(post[0]).toBe('/api/plan');
    expect((post[1]!.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('shows problems on a failed import and keeps the previous plan', async () => {
    mockFetch(fixturePlan(), [
      {
        status: 400,
        body: {
          error: 'invalid_plan',
          problems: [
            { sheet: 'T2 Adoption', message: 'action table header not found' },
            { sheet: 'T3 Management', row: 27, message: 'due "Q5 2027" is not a month' },
          ],
        },
      },
    ]);
    renderApp('/?today=2026-09-28');
    await screen.findByLabelText('Timeline');
    pick('broken.xlsx');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't import broken.xlsx");
    const rows = [...alert.querySelectorAll('tbody tr')].map((r) =>
      [...r.querySelectorAll('td')].map((td) => td.textContent)
    );
    expect(rows).toEqual([
      ['T2 Adoption', '—', 'Action table header not found'],
      ['T3 Management', '27', 'Due "Q5 2027" is not a month'],
    ]);
    expect(alert.textContent).toMatch(/Nothing was replaced — everyone still sees the import from/);
    expect(screen.getByLabelText('Timeline')).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain('from axc-fy2026-27.xlsx');
    fireEvent.click(within(alert).getByRole('button', { name: 'Keep current plan' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('import — mapping dialog', () => {
  const res = parseFixture(FIXTURE_V21);
  if (res.ok || !('needsMapping' in res)) throw new Error('fixture should need a mapping');
  const unknown = res.needsMapping;

  it('asks for new words, then re-sends the same file with the chosen mapping', async () => {
    const plan = fixturePlanV21();
    const fetch = mockFetch(fixturePlan(), [
      { status: 422, body: { error: 'needs_mapping', unknown } },
      {
        status: 200,
        body: {
          plan,
          warnings: [{ message: 'template version 2.1 is newer than tested 2.0' }],
          applied: [
            { field: 'status', word: 'In progress', meaning: 'on_track' },
            { field: 'quarter', word: 'FY27-28', meaning: 'next_year' },
          ],
        },
      },
    ]);
    renderApp('/?today=2026-09-29');
    await screen.findByLabelText('Timeline');
    pick('v21.xlsx');
    const dialog = await screen.findByRole('dialog', { name: 'Map new values' });
    expect(dialog.textContent).toContain('Roadline doesn’t know yet');
    expect(dialog.textContent).toContain('v21.xlsx');
    expect(dialog.textContent).toContain('Means · suggested');
    const select = (word: string) =>
      within(dialog).getByLabelText(`Meaning of ${word}`) as HTMLSelectElement;
    expect(select('In progress').value).toBe('on_track');
    expect(select('Blocked').value).toBe('behind');
    expect(select('FY27-28').value).toBe('next_year');
    expect(dialog.textContent).toContain("listed in the file's Status dropdown");
    expect(dialog.textContent).toContain('7 actions');

    fireEvent.change(select('Blocked'), { target: { value: 'at_risk' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply & import' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const posts = fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    const [first, second] = posts.map(([, init]) => init!.body as FormData);
    expect(second.get('file')).toBe(first.get('file'));
    expect(JSON.parse(second.get('mapping') as string)).toEqual({
      status: { 'in progress': 'on_track', blocked: 'at_risk' },
      quarter: { 'fy27-28': 'next_year' },
      due: {},
    });
    const notes = screen.getByLabelText('Import notes');
    expect(notes.textContent).toContain(
      'Applied saved mappings: In progress → On track · FY27-28 → Next year'
    );
    expect(notes.textContent).toContain(
      'Template version 2.1 is newer than tested 2.0. Shown once for this version.'
    );
  });

  it('cancels without importing anything', async () => {
    const fetch = mockFetch(fixturePlan(), [
      { status: 422, body: { error: 'needs_mapping', unknown } },
    ]);
    renderApp('/?today=2026-09-29');
    await screen.findByLabelText('Timeline');
    pick('v21.xlsx');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Import notes').textContent).toContain(
      'Import cancelled — v21.xlsx was not imported.'
    );
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(screen.getByRole('banner').textContent).toContain('from axc-fy2026-27.xlsx');
  });
});
