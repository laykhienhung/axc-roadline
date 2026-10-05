// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixturePlan, fixturePlanV21, fixturePlanV42 } from './helpers';
import { mockFetch, renderApp } from './render';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('target detail page', () => {
  it('shows T1 header, next 3, action plan by quarter and sections', async () => {
    mockFetch(fixturePlan());
    renderApp('/target/T1?today=2026-09-28');
    const head = await screen.findByLabelText('Target');
    expect(within(head).getByRole('heading', { level: 1 }).textContent).toBe(
      'Build AI Tools & Automation'
    );
    expect(head.textContent).toContain('Overdue0');
    expect(head.textContent).toContain('Weight34%');
    expect(head.textContent).toContain('OwnerDeveloper');
    expect(head.textContent).toContain('0 / 26 done');

    const next = screen.getByLabelText('Next for this target');
    expect(next.querySelectorAll('li')).toHaveLength(3);
    expect(next.textContent).toContain('Process inventory + needs survey');

    const tiles = screen.getByLabelText('Quarters');
    expect(
      within(tiles)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'))
    ).toEqual(['#q1', '#q2', '#q3', '#q4']);
    expect(tiles.querySelector('a')!.textContent).toContain('NOW');

    const plan = screen.getByLabelText('Action plan');
    const quarters = [...plan.querySelectorAll('[data-quarter]')].map((q) =>
      q.getAttribute('data-quarter')
    );
    expect(quarters).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    const q1 = plan.querySelector('[data-quarter="Q1"]')!;
    expect(q1.textContent).toContain('NOW');
    expect(q1.textContent).toContain('Sep – Nov 2026 · 7 actions');
    expect(q1.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(plan.querySelector('#q1')).not.toBeNull();

    const details = screen.getByLabelText('Target details');
    expect(details.querySelector('details')).toBeNull();
    const headings = [...details.querySelectorAll('h3')].map((h) => h.textContent);
    expect(headings).toEqual([
      'What this must achieve',
      'Depends on',
      'Risks & mitigation',
      'How we will do it',
      'Change history',
    ]);
    expect(details.textContent).toContain('No changes recorded');
    const deps = within(details).getByLabelText('Depends on');
    expect([...deps.querySelectorAll('.chip')].map((c) => c.textContent)).toEqual([
      'T2',
      'T3',
      'T4',
    ]);
    expect(screen.getByRole('link', { name: 'Timeline' }).getAttribute('href')).toBe(
      '/?today=2026-09-28'
    );
  });

  it('lists ongoing actions in their own block', async () => {
    mockFetch(fixturePlan());
    renderApp('/target/T2?today=2026-09-28');
    const plan = await screen.findByLabelText('Action plan');
    expect(plan.querySelectorAll('[data-quarter="ongoing"] tbody tr')).toHaveLength(2);
  });

  it('shows "Target not found" for an unknown id', async () => {
    mockFetch(fixturePlan());
    renderApp('/target/T9');
    expect(await screen.findByText('Target not found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to timeline' })).toBeTruthy();
  });

  it('shows the Next-year block and this-year progress for v2.1', async () => {
    mockFetch(fixturePlanV21());
    renderApp('/target/T1?today=2026-09-29');
    const head = await screen.findByLabelText('Target');
    expect(head.textContent).toContain('2 / 12 done');
    expect(head.textContent).toContain('this year · 7 more next year');
    const plan = screen.getByLabelText('Action plan');
    const ny = plan.querySelector('[data-quarter="next_year"]')!;
    expect(ny.textContent).toContain('Next year FY27-28 · 7 actions');
    expect(ny.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(within(plan).getAllByText('In progress')[0].className).toContain('tone-on_track');
    const next = screen.getByLabelText('Next for this target');
    expect(next.textContent).not.toContain('Feedback log');
  });

  it('has no Next-year block for the v2.0 plan', async () => {
    mockFetch(fixturePlan());
    renderApp('/target/T1?today=2026-09-28');
    await screen.findByLabelText('Action plan');
    expect(document.querySelector('[data-quarter="next_year"]')).toBeNull();
  });

  it('shows "Target", Success measure and no % column or Objective details for 2.x', async () => {
    mockFetch(fixturePlan());
    renderApp('/target/T1?today=2026-09-28');
    await screen.findByLabelText('Target');
    expect(screen.queryByLabelText('Objective details')).toBeNull();
    const q1 = screen.getByLabelText('Action plan').querySelector('[data-quarter="Q1"]')!;
    const headers = [...q1.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['#', 'Action', 'Success measure', 'Owner', 'Due', 'Status']);
    expect(q1.querySelector('.dchip')).toBeNull();
  });
});

describe('objective page (template 4.2)', () => {
  it('shows O1 with equal weight, average %, objective details and the 4.2 columns', async () => {
    mockFetch(fixturePlanV42());
    renderApp('/target/O1?today=2026-10-01');
    const head = await screen.findByLabelText('Objective');
    expect(within(head).getByRole('heading', { level: 1 }).textContent).toBe('Strategy & Roadmap');
    expect(head.textContent).toContain('Weight17%equal · 1 of 6');
    expect(head.textContent).toMatch(/Progress\d+% avg of 7/);
    expect(head.textContent).toContain('0 / 7 done');
    expect(screen.queryByLabelText('Target')).toBeNull();
    const next = screen.getByLabelText('Next for this objective');
    expect(within(next).getByRole('heading').textContent).toBe('Next for this objective');

    // 4.2 has none of the 2.x note blocks, so the empty side column is not rendered.
    expect(screen.queryByLabelText('More on this objective')).toBeNull();
    const details = screen.getByLabelText('Objective details');
    expect([...details.querySelectorAll('.did')].map((d) => d.textContent)).toEqual(['1.1', '1.2']);
    expect(details.textContent).toContain('AI strategy & roadmap approved');
    expect(details.textContent).toContain('Goal: One company AI strategy');
    expect(details.textContent).toContain('JD: 1.5, 5.5');
    expect(details.textContent).toContain('avg · 3 actions');

    const q1 = screen.getByLabelText('Action plan').querySelector('[data-quarter="Q1"]')!;
    const headers = [...q1.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['#', 'Action', 'Partners', 'Owner', 'Due', '%', 'Status']);
    const row2 = q1.querySelectorAll('tbody tr')[1];
    expect(row2.querySelector('.dchip')!.textContent).toBe('1.1');
    expect(row2.querySelector('.act')!.textContent).toBe('1.1Write strategy + roadmap');
    expect(row2.querySelector('.ref')!.textContent).toBe(
      '📎 [AXC] AXC_Team_Objectives_ActionPlan_FY2026-2027.xlsx · AXC_AI_Transformation_Objectives_BOD.xlsx · +1'
    );
    expect(row2.querySelector('.note')!.textContent).toMatch(/^Roadmap \+ objectives drafted/);
    expect(row2.querySelector('.measure')!.textContent).toBe('BOD sponsor');
    expect(row2.querySelector('.sub')).toBeNull();
  });

  it('says "Objective not found" for an unknown id', async () => {
    mockFetch(fixturePlanV42());
    renderApp('/target/O9');
    expect(await screen.findByText('Objective not found')).toBeTruthy();
  });
});
